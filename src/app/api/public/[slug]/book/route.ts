import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBookingSchema } from '@/lib/modules/booking/validators'
import { buildBookingAggregate, validateNoDoubleBooking } from '@/lib/modules/booking/service'
import { buildNotificationPayload, signWebhookPayload } from '@/lib/modules/notification/service'
import { rateLimit } from '@/lib/rate-limit'
import type { Service, StaffProfile, BookingAssignment } from '@/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Rate limit: 10 bookings per IP per minute
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const { success: rateLimitOk } = rateLimit(`book:${ip}`, 10, 60_000)
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tente novamente em breve.' }, { status: 429 })
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const input = parsed.data

  const supabase = await createClient()

  // 1. Get business by slug
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, timezone, locale, currency')
    .eq('slug', slug)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  if (business.id !== input.businessId) {
    return NextResponse.json({ error: 'Business ID mismatch' }, { status: 400 })
  }

  // 1b. Reject past dates (using UTC comparison — safe for most timezones within a day)
  const bookingDateTime = new Date(`${input.date}T${input.startTime}:00.000Z`)
  const now = new Date()
  // Allow a 2-hour buffer to account for timezone differences
  if (bookingDateTime.getTime() < now.getTime() - 2 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Não é possível marcar para uma data/hora no passado' }, { status: 400 })
  }

  // 2. Fetch services and staff for all requested items
  const serviceIds = [...new Set(input.services.map((s) => s.serviceId))]
  const staffIds = [...new Set(input.services.map((s) => s.staffId))]

  const [{ data: services }, { data: staffProfiles }, { data: staffServices }] = await Promise.all([
    supabase
      .from('services')
      .select('*')
      .in('id', serviceIds)
      .eq('business_id', business.id)
      .eq('is_active', true),
    supabase
      .from('staff_profiles')
      .select('*')
      .in('id', staffIds)
      .eq('business_id', business.id)
      .eq('is_active', true),
    supabase
      .from('staff_services')
      .select('*')
      .in('staff_id', staffIds)
      .in('service_id', serviceIds),
  ])

  // 3. Validate all services and staff exist and are eligible
  const serviceMap = new Map((services || []).map((s) => [s.id, s]))
  const staffMap = new Map((staffProfiles || []).map((s) => [s.id, s]))
  const staffServiceSet = new Set(
    (staffServices || []).map((ss) => `${ss.staff_id}:${ss.service_id}`)
  )

  for (const item of input.services) {
    const service = serviceMap.get(item.serviceId)
    if (!service) {
      return NextResponse.json(
        { error: `Service ${item.serviceId} not found or inactive` },
        { status: 400 }
      )
    }

    const staff = staffMap.get(item.staffId)
    if (!staff) {
      return NextResponse.json(
        { error: `Staff ${item.staffId} not found or inactive` },
        { status: 400 }
      )
    }

    if (!staffServiceSet.has(`${item.staffId}:${item.serviceId}`)) {
      return NextResponse.json(
        { error: `Staff ${staff.name} does not offer service ${service.name}` },
        { status: 400 }
      )
    }
  }

  // 4. Build aggregate (pure function)
  const items = input.services.map((item) => {
    const service = serviceMap.get(item.serviceId) as Service
    const staff = staffMap.get(item.staffId) as StaffProfile
    const ss = (staffServices || []).find(
      (ss) => ss.staff_id === item.staffId && ss.service_id === item.serviceId
    )
    return {
      service,
      staff,
      customDuration: ss?.custom_duration_minutes ?? null,
    }
  })

  const aggregate = buildBookingAggregate({
    businessId: business.id,
    date: input.date,
    startTime: input.startTime,
    timezone: input.timezone,
    items,
  })

  // 5. Double-booking check — fetch existing assignments for all involved staff
  const { data: existingAssignments } = await supabase
    .from('booking_assignments')
    .select('*')
    .in('staff_id', staffIds)
    .lte('starts_at', aggregate.endsAt)
    .gte('ends_at', aggregate.startsAt)

  for (const line of aggregate.lines) {
    const check = validateNoDoubleBooking({
      staffId: line.staffId,
      startsAt: line.startsAt,
      endsAt: line.endsAt,
      existingAssignments: (existingAssignments || []) as BookingAssignment[],
    })

    if (!check.isValid) {
      return NextResponse.json(
        { error: `Slot no longer available for ${line.staffName} (${line.serviceName})` },
        { status: 409 }
      )
    }
  }

  // 6. Create/upsert customer
  let customerId: string

  if (input.customerEmail) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', business.id)
      .eq('email', input.customerEmail)
      .single()

    if (existing) {
      customerId = existing.id
      await supabase
        .from('customers')
        .update({ name: input.customerName, phone: input.customerPhone || null })
        .eq('id', customerId)
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          business_id: business.id,
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone || null,
        })
        .select('id')
        .single()

      if (custErr || !newCustomer) {
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
      }
      customerId = newCustomer.id
    }
  } else {
    const { data: newCustomer, error: custErr } = await supabase
      .from('customers')
      .insert({
        business_id: business.id,
        name: input.customerName,
        phone: input.customerPhone || null,
      })
      .select('id')
      .single()

    if (custErr || !newCustomer) {
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  // 7. Insert booking aggregate (header + lines + assignments)
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      business_id: business.id,
      customer_id: customerId,
      status: 'pending',
      total_price_cents: aggregate.totalPriceCents,
      total_duration_minutes: aggregate.totalDurationMinutes,
      currency: aggregate.currency,
      notes: input.notes || null,
      starts_at: aggregate.startsAt,
      ends_at: aggregate.endsAt,
    })
    .select('id')
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // Insert booking_services
  const bookingServicesData = aggregate.lines.map((line) => ({
    booking_id: booking.id,
    service_id: line.serviceId,
    service_name: line.serviceName,
    price_cents: line.priceCents,
    duration_minutes: line.durationMinutes,
    sort_order: line.sortOrder,
  }))

  const { data: bookingServices, error: bsErr } = await supabase
    .from('booking_services')
    .insert(bookingServicesData)
    .select('id, service_id')

  if (bsErr || !bookingServices) {
    // Rollback: delete the booking header
    await supabase.from('bookings').delete().eq('id', booking.id)
    return NextResponse.json({ error: 'Failed to create booking services' }, { status: 500 })
  }

  // Insert booking_assignments
  const assignmentsData = aggregate.lines.map((line, i) => {
    const bs = bookingServices.find((b) => b.service_id === line.serviceId)
    return {
      booking_service_id: bs!.id,
      staff_id: line.staffId,
      starts_at: line.startsAt,
      ends_at: line.endsAt,
    }
  })

  const { error: assignErr } = await supabase
    .from('booking_assignments')
    .insert(assignmentsData)

  if (assignErr) {
    await supabase.from('bookings').delete().eq('id', booking.id)
    // Check if it's a double-booking constraint violation
    if (assignErr.message?.includes('no_staff_overlap') || assignErr.code === '23P01') {
      return NextResponse.json({ error: 'Slot no longer available — conflito de horário' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create assignments' }, { status: 500 })
  }

  // 8. Create notification event (async, fire-and-forget for n8n)
  const notifPayload = buildNotificationPayload({
    business: {
      id: business.id,
      name: business.name,
      locale: business.locale,
      timezone: business.timezone,
      currency: business.currency,
    },
    booking: {
      id: booking.id,
      startsAt: aggregate.startsAt,
      endsAt: aggregate.endsAt,
      totalPriceCents: aggregate.totalPriceCents,
      currency: aggregate.currency,
    },
    customer: {
      name: input.customerName,
      email: input.customerEmail || null,
      phone: input.customerPhone || null,
    },
    services: aggregate.lines.map((l) => ({
      serviceName: l.serviceName,
      staffName: l.staffName,
      startsAt: l.startsAt,
      endsAt: l.endsAt,
      priceCents: l.priceCents,
    })),
  })

  await supabase.from('notification_events').insert({
    business_id: business.id,
    booking_id: booking.id,
    event_type: 'booking_created',
    payload: notifPayload as unknown as Record<string, unknown>,
    status: 'pending',
  })

  // Note: No webhook fired here — email will be sent when business approves (confirms) the booking

  // 9. Return result
  return NextResponse.json({
    bookingId: booking.id,
    status: 'pending',
    totalPriceCents: aggregate.totalPriceCents,
    totalDurationMinutes: aggregate.totalDurationMinutes,
    currency: aggregate.currency,
    startsAt: aggregate.startsAt,
    endsAt: aggregate.endsAt,
    services: aggregate.lines.map((l) => ({
      serviceName: l.serviceName,
      staffName: l.staffName,
      startsAt: l.startsAt,
      endsAt: l.endsAt,
      priceCents: l.priceCents,
    })),
  })
}
