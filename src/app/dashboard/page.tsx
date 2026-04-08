import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarCheck, Users, Scissors, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bizData } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  const business = bizData as { id: string } | null

  // If no business yet, redirect to onboarding
  if (!business) {
    redirect('/dashboard/onboarding')
  }

  const businessId = business.id

  // Fetch stats
  const [
    { count: bookingsToday },
    { count: totalProfessionals },
    { count: totalServices },
    { count: totalCustomers },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('start_time', new Date().toISOString().split('T')[0])
      .lt('start_time', new Date(Date.now() + 86400000).toISOString().split('T')[0]),
    supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId),
  ])

  const stats = [
    { label: 'Marcações Hoje', value: bookingsToday ?? 0, icon: CalendarCheck },
    { label: 'Profissionais', value: totalProfessionals ?? 0, icon: Users },
    { label: 'Serviços', value: totalServices ?? 0, icon: Scissors },
    { label: 'Clientes', value: totalCustomers ?? 0, icon: Clock },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel</h1>
        <p className="text-muted-foreground">Resumo do teu negócio</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
