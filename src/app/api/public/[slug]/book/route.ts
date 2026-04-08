import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = await request.json()

  const {
    professional_id,
    service_id,
    start_time,
    customer_name,
    customer_email,
    customer_phone,
    notes,
  } = body

  if (!professional_id || !service_id || !start_time || !customer_name) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Get business
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Get service for duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', service_id)
    .eq('business_id', business.id)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  // Calculate end time
  const startDate = new Date(start_time)
  const endDate = new Date(startDate.getTime() + service.duration_minutes * 60000)

  // Check for conflicts (atomic check)
  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('professional_id', professional_id)
    .neq('status', 'cancelled')
    .lt('start_time', endDate.toISOString())
    .gt('end_time', startDate.toISOString())

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Slot no longer available' },
      { status: 409 }
    )
  }

  // Create or find customer
  let customerId: string

  if (customer_email) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', business.id)
      .eq('email', customer_email)
      .single()

    if (existing) {
      customerId = existing.id
      // Update name/phone if changed
      await supabase
        .from('customers')
        .update({ name: customer_name, phone: customer_phone || null })
        .eq('id', customerId)
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          business_id: business.id,
          name: customer_name,
          email: customer_email,
          phone: customer_phone || null,
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
        name: customer_name,
        phone: customer_phone || null,
      })
      .select('id')
      .single()

    if (custErr || !newCustomer) {
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  // Create booking
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      business_id: business.id,
      professional_id,
      service_id,
      customer_id: customerId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: 'confirmed',
      notes: notes || null,
    })
    .select('id')
    .single()

  if (bookingErr) {
    return NextResponse.json({ error: bookingErr.message }, { status: 500 })
  }

  return NextResponse.json({ booking_id: booking.id, status: 'confirmed' })
}
