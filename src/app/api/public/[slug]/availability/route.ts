import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAvailableSlots } from '@/lib/availability'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const professionalId = searchParams.get('professional_id')
  const serviceId = searchParams.get('service_id')
  const dateStr = searchParams.get('date')

  if (!professionalId || !serviceId || !dateStr) {
    return NextResponse.json(
      { error: 'Missing required params: professional_id, service_id, date' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Get business by slug
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Get service duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .eq('business_id', business.id)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  const date = new Date(dateStr + 'T00:00:00')

  // Fetch all needed data in parallel
  const [
    { data: workingHours },
    { data: breaks },
    { data: bookings },
    { data: timeOff },
  ] = await Promise.all([
    supabase
      .from('working_hours')
      .select('*')
      .eq('professional_id', professionalId),
    supabase
      .from('breaks')
      .select('*')
      .eq('professional_id', professionalId),
    supabase
      .from('bookings')
      .select('*')
      .eq('professional_id', professionalId)
      .neq('status', 'cancelled')
      .gte('start_time', dateStr + 'T00:00:00')
      .lt('start_time', dateStr + 'T23:59:59'),
    supabase
      .from('time_off')
      .select('*')
      .eq('professional_id', professionalId)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr),
  ])

  const slots = getAvailableSlots({
    date,
    serviceDuration: service.duration_minutes,
    workingHours: workingHours || [],
    breaks: breaks || [],
    bookings: bookings || [],
    timeOff: timeOff || [],
  })

  return NextResponse.json({ slots })
}
