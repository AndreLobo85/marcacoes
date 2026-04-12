import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, Users, CalendarCheck, Euro, TrendingUp } from 'lucide-react'

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalBusinesses },
    { count: totalBookings },
    { count: totalCustomers },
    { data: allBookings },
    { data: recentBusinesses },
  ] = await Promise.all([
    supabase.from('businesses').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('total_price_cents, status'),
    supabase.from('businesses').select('id, name, slug, subscription_plan, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  // Count users via admin
  let totalUsers = 0
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.listUsers()
    totalUsers = data?.users?.length || 0
  } catch { /* service role not configured */ }

  const totalRevenue = (allBookings || [])
    .filter((b: { status: string }) => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum: number, b: { total_price_cents: number }) => sum + b.total_price_cents, 0)

  const pendingBookings = (allBookings || []).filter((b: { status: string }) => b.status === 'pending').length

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral de toda a plataforma Marcações.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Negócios', value: totalBusinesses ?? 0, icon: Building2 },
          { label: 'Utilizadores', value: totalUsers, icon: Users },
          { label: 'Marcações', value: totalBookings ?? 0, icon: CalendarCheck },
          { label: 'Clientes', value: totalCustomers ?? 0, icon: Users },
          { label: 'Receita Total', value: formatPrice(totalRevenue), icon: Euro },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-xl font-serif font-bold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {pendingBookings > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="py-3 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-accent" />
            <p className="text-sm font-medium">{pendingBookings} marcações pendentes na plataforma</p>
          </CardContent>
        </Card>
      )}

      {/* Recent businesses */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Negócios Recentes</p>
          <div className="space-y-3">
            {(recentBusinesses || []).map((b: { id: string; name: string; slug: string; subscription_plan: string; created_at: string }) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-semibold text-sm">{b.name}</p>
                  <p className="text-[11px] text-muted-foreground">/{b.slug} · {new Date(b.created_at).toLocaleDateString('pt-PT')}</p>
                </div>
                <span className="badge-gold">{b.subscription_plan}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
