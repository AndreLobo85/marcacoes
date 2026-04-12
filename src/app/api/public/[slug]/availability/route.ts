import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAvailableSlots } from '@/lib/modules/schedule/service'
import { getAvailabilitySchema } from '@/lib/modules/schedule/validators'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)

  // Validate query params
  const parsed = getAvailabilitySchema.safeParse({
    date: searchParams.get('date'),
    serviceId: searchParams.get('service_id'),
    staffId: searchParams.get('staff_id') || undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid params', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { date, serviceId, staffId } = parsed.data
  const supabase = await createClient()

  // Get business by slug
  const { data: business } = await supabase
    .from('businesses')
    .select('id, timezone')
    .eq('slug', slug)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Get service for duration + eligible staff
  const { data: service } = await supabase
    .from('services')
    .select('id, duration_minutes')
    .eq('id', serviceId)
    .eq('business_id', business.id)
    .eq('is_active', true)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  // Get eligible staff for this service
  const staffQuery = supabase
    .from('staff_services')
    .select('staff_id, custom_duration_minutes')
    .eq('service_id', serviceId)

  if (staffId) {
    staffQuery.eq('staff_id', staffId)
  }

  const { data: eligibleStaff } = await staffQuery

  if (!eligibleStaff || eligibleStaff.length === 0) {
    return NextResponse.json({ slots: [], staffAvailability: [] })
  }

  const staffIds = eligibleStaff.map((s) => s.staff_id)
  const dateObj = new Date(date + 'T00:00:00Z')

  // Fetch all needed data in parallel
  const [
    { data: businessHours },
    { data: staffWorkingHours },
    { data: blockedSlots },
    { data: assignments },
  ] = await Promise.all([
    supabase
      .from('business_hours')
      .select('*')
      .eq('business_id', business.id),
    supabase
      .from('staff_working_hours')
      .select('*')
      .in('staff_id', staffIds),
    supabase
      .from('blocked_slots')
      .select('*')
      .eq('business_id', business.id)
      .or(`staff_id.is.null,staff_id.in.(${staffIds.join(',')})`)
      .lte('starts_at', date + 'T23:59:59Z')
      .gte('ends_at', date + 'T00:00:00Z'),
    supabase
      .from('booking_assignments')
      .select('*')
      .in('staff_id', staffIds)
      .lte('starts_at', date + 'T23:59:59Z')
      .gte('ends_at', date + 'T00:00:00Z'),
  ])

  // Calculate availability per staff member
  const staffAvailability = staffIds.map((sid) => {
    const staffService = eligibleStaff.find((s) => s.staff_id === sid)
    const duration = staffService?.custom_duration_minutes ?? service.duration_minutes

    const result = getAvailableSlots({
      date: dateObj,
      businessId: business.id,
      staffId: sid,
      serviceDuration: duration,
      businessHours: businessHours || [],
      staffWorkingHours: (staffWorkingHours || []).filter((swh) => swh.staff_id === sid),
      blockedSlots: (blockedSlots || []).filter((bs) => bs.staff_id === sid || bs.staff_id === null),
      existingAssignments: (assignments || []).filter((a) => a.staff_id === sid),
      timezone: business.timezone,
    })

    return result
  })

  // Flatten all slots for convenience
  const allSlots = staffAvailability.flatMap((sa) =>
    sa.slots.map((slot) => ({ ...slot, staffId: sa.staffId }))
  )

  return NextResponse.json({
    slots: allSlots,
    staffAvailability,
  })
}
