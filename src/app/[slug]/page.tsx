import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicBookingPage } from '@/components/public/public-booking-page'
import type { Business, Service, StaffProfile, StaffService } from '@/types/database'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('businesses').select('*').eq('slug', slug).single()
  const business = data as Business | null
  if (!business) return { title: 'Não encontrado' }
  return {
    title: `${business.name} — Marcações Online`,
    description: business.description || `Faz a tua marcação online em ${business.name}`,
  }
}

export default async function BookingPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: bizData } = await supabase.from('businesses').select('*').eq('slug', slug).single()
  const business = bizData as Business | null
  if (!business) notFound()

  const [{ data: svcData }, { data: staffData }] = await Promise.all([
    supabase.from('services').select('*').eq('business_id', business.id).eq('is_active', true).order('sort_order'),
    supabase.from('staff_profiles').select('*').eq('business_id', business.id).eq('is_active', true).order('sort_order'),
  ])

  const services = (svcData || []) as Service[]
  const staffProfiles = (staffData || []) as StaffProfile[]

  // Fetch staff_services scoped to this business's services and staff
  const serviceIds = services.map((s) => s.id)
  const staffIds = staffProfiles.map((s) => s.id)
  const { data: ssData } = serviceIds.length > 0
    ? await supabase.from('staff_services').select('*').in('service_id', serviceIds).in('staff_id', staffIds)
    : { data: [] }
  const relevantSS = (ssData || []) as StaffService[]

  return (
    <PublicBookingPage
      slug={slug}
      business={business}
      services={services}
      staff={staffProfiles}
      staffServices={relevantSS}
    />
  )
}
