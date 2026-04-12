import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  CalendarCheck, Euro, UserPlus, Clock, AlertCircle, ArrowRight, MoreVertical, Scissors,
} from 'lucide-react'
import Link from 'next/link'
import { NewBookingButton } from '@/components/dashboard/new-booking-button'
import type {
  Business, StaffProfile, Booking, BookingService, BookingAssignment, Customer,
} from '@/types/database'

function formatPrice(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bizData } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  const business = bizData as Business | null
  if (!business) redirect('/dashboard/onboarding')

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'
  const lastWeekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const prevWeekStart = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]

  const [
    { data: allBookings },
    { data: staffData },
    { data: customersData },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.from('bookings').select('*').eq('business_id', business.id),
    supabase.from('staff_profiles').select('*').eq('business_id', business.id).eq('is_active', true).order('sort_order'),
    supabase.from('customers').select('*').eq('business_id', business.id),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'pending'),
  ])

  // Scoped: fetch booking_services and assignments only for this business's bookings
  const bookingIds = (allBookings || []).map((b: Booking) => b.id)
  const [{ data: bsData }, { data: assignData }] = bookingIds.length > 0 ? await Promise.all([
    supabase.from('booking_services').select('*').in('booking_id', bookingIds),
    supabase.from('booking_assignments').select('*').in('booking_service_id',
      (await supabase.from('booking_services').select('id').in('booking_id', bookingIds)).data?.map((bs: { id: string }) => bs.id) || ['none']
    ),
  ]) : [{ data: [] }, { data: [] }]

  const bookings = (allBookings || []) as Booking[]
  const staff = (staffData || []) as StaffProfile[]
  const bookingServices = (bsData || []) as BookingService[]
  const assignments = (assignData || []) as BookingAssignment[]
  const customers = (customersData || []) as Customer[]

  const bsMap = new Map<string, BookingService[]>()
  for (const bs of bookingServices) {
    const list = bsMap.get(bs.booking_id) || []
    list.push(bs)
    bsMap.set(bs.booking_id, list)
  }
  const assignByBsId = new Map(assignments.map((a) => [a.booking_service_id, a]))
  const customerMap = new Map(customers.map((c) => [c.id, c]))
  const staffMap = new Map(staff.map((s) => [s.id, s]))

  // Revenue calculations
  const thisWeekRevenue = bookings
    .filter((b) => b.starts_at >= lastWeekStart && (b.status === 'completed' || b.status === 'confirmed'))
    .reduce((sum, b) => sum + b.total_price_cents, 0)
  const prevWeekRevenue = bookings
    .filter((b) => b.starts_at >= prevWeekStart && b.starts_at < lastWeekStart && (b.status === 'completed' || b.status === 'confirmed'))
    .reduce((sum, b) => sum + b.total_price_cents, 0)
  const revenueChange = prevWeekRevenue > 0 ? Math.round(((thisWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100) : 0

  const newCustomersMonth = customers.filter((c) => c.created_at >= monthStart).length

  // Per-staff stats
  const staffStats = staff.map((s) => {
    const staffAssigns = assignments.filter((a) => a.staff_id === s.id)
    const staffBsIds = new Set(staffAssigns.map((a) => a.booking_service_id))
    let revenueCents = 0
    for (const bs of bookingServices) {
      if (!staffBsIds.has(bs.id)) continue
      const booking = bookings.find((b) => b.id === bs.booking_id)
      if (!booking || booking.status === 'cancelled') continue
      revenueCents += bs.price_cents
    }
    return { ...s, revenueCents }
  }).sort((a, b) => b.revenueCents - a.revenueCents)

  // Today's bookings with enriched data
  const todayBookings = bookings
    .filter((b) => b.starts_at >= today && b.starts_at < tomorrow && b.status !== 'cancelled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  const nowMs = Date.now()
  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const dateLabel = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="badge-gold">Overview</span>
          <h1 className="font-serif text-3xl font-bold mt-2 tracking-tight">Salon Performance</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Manager</p>
          </div>
          <Avatar className="h-11 w-11 border-2 border-accent">
            <AvatarFallback className="bg-accent text-accent-foreground font-semibold text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Revenue */}
        <Card className="relative">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Euro className="h-4 w-4 text-muted-foreground" />
              </div>
              {revenueChange !== 0 && (
                <span className={`text-[10px] font-semibold ${revenueChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {revenueChange > 0 ? '+' : ''}{revenueChange}% vs semana anterior
                </span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Receita Semanal</p>
            <p className="text-2xl font-serif font-bold mt-0.5">{formatPrice(thisWeekRevenue, business.currency)}</p>
          </CardContent>
        </Card>

        {/* New Customers */}
        <Card className="relative">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-semibold text-emerald-600">
                {customers.length} total
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Novos Clientes</p>
            <p className="text-2xl font-serif font-bold mt-0.5">{newCustomersMonth}</p>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="relative">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              {(pendingCount ?? 0) > 0 && (
                <Link href="/dashboard/bookings" className="text-[10px] font-semibold text-accent hover:underline">
                  {pendingCount} Ações
                </Link>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Marcações Pendentes</p>
            <p className="text-2xl font-serif font-bold mt-0.5">{String(pendingCount ?? 0).padStart(2, '0')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Left: Today's Agenda */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-xl font-bold">Today&apos;s Agenda</h2>
          </div>

          {todayBookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground font-serif italic">Sem marcações para hoje.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-4 bottom-4 w-[2px] bg-border" />

              <div className="space-y-4">
                {todayBookings.map((b, idx) => {
                  const bServices = bsMap.get(b.id) || []
                  const customer = customerMap.get(b.customer_id)
                  const firstBs = bServices[0]
                  const assign = firstBs ? assignByBsId.get(firstBs.id) : null
                  const staffMember = assign ? staffMap.get(assign.staff_id) : null
                  const serviceNames = bServices.map((bs) => bs.service_name).join(' + ')

                  const bookingStart = new Date(b.starts_at).getTime()
                  const bookingEnd = new Date(b.ends_at).getTime()
                  const isOngoing = nowMs >= bookingStart && nowMs < bookingEnd
                  const isPending = b.status === 'pending'
                  const isConfirmed = b.status === 'confirmed'

                  // Check if NOW marker should appear before this booking
                  const prevEnd = idx > 0 ? new Date(todayBookings[idx - 1].ends_at).getTime() : 0
                  const showNowBefore = idx === 0 ? nowMs < bookingStart : (nowMs >= prevEnd && nowMs < bookingStart)

                  return (
                    <div key={b.id} className="relative">
                      {/* NOW marker */}
                      {showNowBefore && (
                        <div className="flex items-center gap-2 mb-3 ml-[-1px]">
                          <div className="h-4 w-4 rounded-full bg-accent border-2 border-accent shadow-sm flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-accent">Now</span>
                          <div className="flex-1 h-px bg-accent/30 ml-1" />
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        {/* Timeline dot */}
                        <div className={`mt-5 h-4 w-4 rounded-full border-2 shrink-0 z-10 ${
                          isOngoing ? 'bg-accent border-accent' : 'bg-card border-muted-foreground/30'
                        }`}>
                          {isOngoing && <div className="h-full w-full rounded-full bg-accent animate-pulse" />}
                        </div>

                        {/* Card */}
                        <Card className={`flex-1 transition-all ${isOngoing ? 'border-accent/40 shadow-md bg-accent/[0.03]' : ''}`}>
                          <CardContent className="py-4 px-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Service icon */}
                                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                  isOngoing ? 'bg-accent text-white' : 'bg-secondary text-muted-foreground'
                                }`}>
                                  <Scissors className="h-4 w-4" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  {/* Time */}
                                  <p className="text-xs text-muted-foreground font-medium">
                                    {formatTime(b.starts_at)} — {formatTime(b.ends_at)}
                                  </p>
                                  {/* Service name */}
                                  <p className="font-semibold text-sm mt-0.5 truncate">{serviceNames}</p>
                                  {/* Client + Staff */}
                                  <p className="text-[11px] text-muted-foreground mt-1">
                                    Cliente: {customer?.name || '—'} · {staffMember?.name || '—'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Status badge */}
                                {isPending && (
                                  <span className="badge-gold">Pendente</span>
                                )}
                                {isOngoing && (
                                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                                    Em curso
                                  </span>
                                )}
                                {isConfirmed && !isOngoing && (
                                  <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Confirmada
                                  </span>
                                )}

                                <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Grow Your Business */}
          <Card className="card-dark overflow-hidden">
            <CardContent className="py-6 relative">
              <h3 className="font-serif text-lg font-bold text-white">Grow Your Business</h3>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                Adicione marcações ou envie lembretes aos seus clientes recentes.
              </p>
              <div className="mt-5">
                <NewBookingButton business={business} variant="dark-card" />
              </div>
            </CardContent>
          </Card>

          {/* Top Performance */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-base font-bold">Top Performance</h3>
              <Link href="/dashboard/professionals" className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors">
                Ver todos
              </Link>
            </div>
            <div className="space-y-3.5">
              {staffStats.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    {s.avatar_url ? (
                      <AvatarImage src={s.avatar_url} alt={s.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback
                      style={{ backgroundColor: s.color, color: 'white' }}
                      className="text-xs font-semibold"
                    >
                      {s.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-accent font-medium">
                      {s.bio || 'Staff'}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums">{formatPrice(s.revenueCents, business.currency)}</p>
                </div>
              ))}
              {staffStats.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Sem dados.</p>
              )}
            </div>
          </div>

          {/* Business card */}
          <Card className="overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 border-none">
            <CardContent className="py-5">
              <p className="font-serif text-sm font-bold uppercase tracking-wider">{business.name}</p>
              {business.address && (
                <p className="text-[11px] text-muted-foreground mt-1">{business.address}</p>
              )}
              {business.phone && (
                <p className="text-[11px] text-muted-foreground">{business.phone}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-6 pb-2 border-t border-border flex items-center justify-between">
        <div>
          <p className="font-serif italic text-sm">{business.name}</p>
          <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60 mt-0.5" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} All Rights Reserved
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link href="/dashboard/settings" className="hover:text-accent transition-colors">Settings</Link>
          <span className="text-border">|</span>
          <Link href={`/${business.slug}`} target="_blank" className="hover:text-accent transition-colors">Página Pública</Link>
        </div>
      </footer>
    </div>
  )
}
