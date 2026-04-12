import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildNotificationPayload, signWebhookPayload } from '@/lib/modules/notification/service'
import { logAudit } from '@/lib/audit'
import type { Booking, BookingService, BookingAssignment, StaffProfile, Customer, Business } from '@/types/database'

/**
 * POST /api/internal/bookings/[id]/confirm
 * Confirms a pending booking and fires the confirmation email via n8n.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params
  const supabase = await createClient()

  // 1. Verify authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify user belongs to a business FIRST (auth before data access)
  const { data: memberships } = await supabase
    .from('business_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const memberBusinessIds = memberships.map((m) => m.business_id)

  // 3. Get booking (only if it belongs to one of the user's businesses)
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .in('business_id', memberBusinessIds)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'Booking is not pending' }, { status: 400 })
  }

  // 4. Update status to confirmed
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
  }

  // 5. Get business, customer, services for the notification (scoped queries)
  const { data: bsData } = await supabase.from('booking_services').select('*').eq('booking_id', bookingId)
  const bsIds = (bsData || []).map((bs: BookingService) => bs.id)

  const [{ data: business }, { data: customer }, { data: assignData }, { data: staffData }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', booking.business_id).single(),
    supabase.from('customers').select('*').eq('id', booking.customer_id).single(),
    supabase.from('booking_assignments').select('*').in('booking_service_id', bsIds.length > 0 ? bsIds : ['none']),
    supabase.from('staff_profiles').select('*').eq('business_id', booking.business_id),
  ])

  if (!business || !customer) {
    return NextResponse.json({ status: 'confirmed', bookingId })
  }

  const biz = business as Business
  const cust = customer as Customer
  const bookingServices = (bsData || []) as BookingService[]
  const assignments = (assignData || []) as BookingAssignment[]
  const staffMap = new Map((staffData || []).map((s: StaffProfile) => [s.id, s]))

  // Build service details
  const serviceDetails = bookingServices.map((bs) => {
    const assign = assignments.find((a) => a.booking_service_id === bs.id)
    const staffMember = assign ? staffMap.get(assign.staff_id) : null
    return {
      serviceName: bs.service_name,
      staffName: staffMember?.name || '—',
      startsAt: assign?.starts_at || booking.starts_at,
      endsAt: assign?.ends_at || booking.ends_at,
      priceCents: bs.price_cents,
    }
  })

  // 6. Create notification event for confirmation email
  const notifPayload = buildNotificationPayload({
    business: {
      id: biz.id,
      name: biz.name,
      locale: biz.locale,
      timezone: biz.timezone,
      currency: biz.currency,
    },
    booking: {
      id: bookingId,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      totalPriceCents: booking.total_price_cents,
      currency: booking.currency,
    },
    customer: {
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
    },
    services: serviceDetails,
  })

  await supabase.from('notification_events').insert({
    business_id: booking.business_id,
    booking_id: bookingId,
    event_type: 'booking_confirmed',
    payload: notifPayload as unknown as Record<string, unknown>,
    status: 'pending',
  })

  // 7. Fire webhook to n8n
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET
  if (webhookUrl && webhookSecret) {
    const payloadStr = JSON.stringify({ event: 'booking_confirmed', data: notifPayload })
    const signature = signWebhookPayload(payloadStr, webhookSecret)

    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: payloadStr,
    }).catch(() => {
      // Non-blocking
    })
  }

  // 8. Audit log
  await logAudit(supabase, {
    businessId: booking.business_id,
    userId: user.id,
    action: 'booking_confirmed',
    entityType: 'booking',
    entityId: bookingId,
    details: { customerName: cust.name },
  })

  return NextResponse.json({ status: 'confirmed', bookingId })
}
