import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookingWizard } from '@/components/public/booking-wizard'
import type { Business, Service, Professional } from '@/types/database'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .single()

  const business = data as Business | null
  if (!business) return { title: 'Não encontrado' }

  return {
    title: `${business.name} — Marcações Online`,
    description: business.description || `Faz a tua marcação online em ${business.name}`,
  }
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: bizData } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .single()

  const business = bizData as Business | null
  if (!business) notFound()

  const [{ data: svcData }, { data: profData }] = await Promise.all([
    supabase
      .from('services')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('professionals')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const services = (svcData || []) as Service[]
  const professionals = (profData || []) as Professional[]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card py-6">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h1 className="text-2xl font-bold">{business.name}</h1>
          {business.description && (
            <p className="mt-1 text-muted-foreground">{business.description}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <BookingWizard
          slug={slug}
          business={business}
          services={services || []}
          professionals={professionals || []}
        />
      </main>
    </div>
  )
}
