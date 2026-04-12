'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking, BookingService, BookingAssignment, StaffProfile, Customer, Service } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { CalendarCheck, Euro, UserPlus, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

const CHART_COLORS = ['#C4A265', '#1C1C1C', '#78716C', '#A8884E', '#D4B87A', '#44403C', '#E8E3DA']
const PERIOD_OPTIONS = [
  { label: 'Esta Semana', value: 'week' },
  { label: 'Este Mês', value: 'month' },
  { label: 'Últimos 3 Meses', value: '3months' },
  { label: 'Este Ano', value: 'year' },
  { label: 'Custom', value: 'custom' },
]

function getDateRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date()
  const end = new Date(now); end.setHours(23, 59, 59, 999)

  switch (period) {
    case 'week': {
      const start = new Date(now)
      const day = start.getDay()
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start, end }
    }
    case '3months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { start, end }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { start, end }
    }
    case 'custom': {
      return {
        start: customStart ? new Date(customStart + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1),
        end: customEnd ? new Date(customEnd + 'T23:59:59') : end,
      }
    }
    default: return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
  }
}

function getPreviousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime()
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1),
  }
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [bookingServices, setBookingServices] = useState<BookingService[]>([])
  const [assignments, setAssignments] = useState<BookingAssignment[]>([])
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user.id).single()
    if (!biz) return

    const [
      { data: bookData }, { data: bsData }, { data: assignData },
      { data: staffData }, { data: custData }, { data: svcData },
    ] = await Promise.all([
      supabase.from('bookings').select('*').eq('business_id', biz.id),
      supabase.from('booking_services').select('*'),
      supabase.from('booking_assignments').select('*'),
      supabase.from('staff_profiles').select('*').eq('business_id', biz.id).eq('is_active', true),
      supabase.from('customers').select('*').eq('business_id', biz.id),
      supabase.from('services').select('*').eq('business_id', biz.id),
    ])

    setAllBookings((bookData || []) as Booking[])
    setBookingServices((bsData || []) as BookingService[])
    setAssignments((assignData || []) as BookingAssignment[])
    setStaff((staffData || []) as StaffProfile[])
    setCustomers((custData || []) as Customer[])
    setServices((svcData || []) as Service[])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Filter bookings by period
  const { start: rangeStart, end: rangeEnd } = getDateRange(period, customStart, customEnd)
  const { start: prevStart, end: prevEnd } = getPreviousRange(rangeStart, rangeEnd)

  const filtered = allBookings.filter((b) => {
    const d = new Date(b.starts_at)
    return d >= rangeStart && d <= rangeEnd && b.status !== 'cancelled'
  })

  const prevFiltered = allBookings.filter((b) => {
    const d = new Date(b.starts_at)
    return d >= prevStart && d <= prevEnd && b.status !== 'cancelled'
  })

  // KPIs
  const totalBookings = filtered.length
  const prevTotalBookings = prevFiltered.length
  const bookingsChange = prevTotalBookings > 0 ? Math.round(((totalBookings - prevTotalBookings) / prevTotalBookings) * 100) : 0

  const revenue = filtered.filter((b) => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => sum + b.total_price_cents, 0)
  const prevRevenue = prevFiltered.filter((b) => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => sum + b.total_price_cents, 0)
  const revenueChange = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0

  const newClients = customers.filter((c) => {
    const d = new Date(c.created_at)
    return d >= rangeStart && d <= rangeEnd
  }).length

  const completedBookings = filtered.filter((b) => b.status === 'completed').length

  // Build booking service map
  const bsByBooking = new Map<string, BookingService[]>()
  for (const bs of bookingServices) {
    const list = bsByBooking.get(bs.booking_id) || []
    list.push(bs)
    bsByBooking.set(bs.booking_id, list)
  }
  const assignByBsId = new Map(assignments.map((a) => [a.booking_service_id, a]))

  // Chart 1: Bookings per day
  const bookingsPerDay = new Map<string, { date: string; bookings: number; revenue: number }>()
  for (const b of filtered) {
    const day = b.starts_at.split('T')[0]
    const existing = bookingsPerDay.get(day) || { date: day, bookings: 0, revenue: 0 }
    existing.bookings++
    if (b.status === 'completed' || b.status === 'confirmed') existing.revenue += b.total_price_cents
    bookingsPerDay.set(day, existing)
  }
  const dailyData = [...bookingsPerDay.values()].sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, revenue: d.revenue / 100, label: new Date(d.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) }))

  // Chart 2: Top services
  const serviceCount = new Map<string, { name: string; count: number; revenue: number }>()
  for (const b of filtered) {
    const lines = bsByBooking.get(b.id) || []
    for (const bs of lines) {
      const existing = serviceCount.get(bs.service_name) || { name: bs.service_name, count: 0, revenue: 0 }
      existing.count++
      existing.revenue += bs.price_cents
      serviceCount.set(bs.service_name, existing)
    }
  }
  const topServices = [...serviceCount.values()].sort((a, b) => b.count - a.count).slice(0, 6)

  // Chart 3: Revenue per staff
  const staffRevenue = new Map<string, { name: string; color: string; revenue: number; count: number }>()
  for (const b of filtered) {
    const lines = bsByBooking.get(b.id) || []
    for (const bs of lines) {
      const assign = assignByBsId.get(bs.id)
      if (!assign) continue
      const s = staff.find((st) => st.id === assign.staff_id)
      if (!s) continue
      const existing = staffRevenue.get(s.id) || { name: s.name, color: s.color, revenue: 0, count: 0 }
      existing.revenue += bs.price_cents
      existing.count++
      staffRevenue.set(s.id, existing)
    }
  }
  const staffData = [...staffRevenue.values()].sort((a, b) => b.revenue - a.revenue)

  // Chart 4: 6-month trend
  const monthlyTrend: Array<{ month: string; bookings: number; revenue: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('pt-PT', { month: 'short' })
    const monthBookings = allBookings.filter((b) => b.starts_at.startsWith(monthKey) && b.status !== 'cancelled')
    const monthRevenue = monthBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed')
      .reduce((sum, b) => sum + b.total_price_cents, 0)
    monthlyTrend.push({ month: monthLabel, bookings: monthBookings.length, revenue: monthRevenue / 100 })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Business insights and performance metrics.</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {PERIOD_OPTIONS.filter((p) => p.value !== 'custom').map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              className="text-xs uppercase tracking-wider"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            variant={period === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="text-xs uppercase tracking-wider"
            onClick={() => setPeriod('custom')}
          >
            Custom
          </Button>
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex gap-3 items-center">
          <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40 bg-card text-sm" />
          <span className="text-muted-foreground text-sm">a</span>
          <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40 bg-card text-sm" />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              {bookingsChange !== 0 && (
                <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${bookingsChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {bookingsChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(bookingsChange)}%
                </span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Marcações</p>
            <p className="text-2xl font-serif font-bold mt-0.5">{totalBookings}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{completedBookings} concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Euro className="h-4 w-4 text-muted-foreground" />
              </div>
              {revenueChange !== 0 && (
                <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${revenueChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {revenueChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(revenueChange)}%
                </span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Faturação</p>
            <p className="text-2xl font-serif font-bold mt-0.5">{formatPrice(revenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">vs {formatPrice(prevRevenue)} período anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Novos Clientes</p>
            <p className="text-2xl font-serif font-bold mt-0.5">{newClients}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{customers.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Ticket Médio</p>
            <p className="text-2xl font-serif font-bold mt-0.5">{totalBookings > 0 ? formatPrice(Math.round(revenue / totalBookings)) : '0,00 €'}</p>
            <p className="text-[10px] text-muted-foreground mt-1">por marcação</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Bookings + Revenue per day */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-accent" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Marcações por Dia</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DA" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8E3DA' }} />
                  <Bar dataKey="bookings" fill="#C4A265" radius={[4, 4, 0, 0]} name="Marcações" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Euro className="h-4 w-4 text-accent" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold">Faturação por Dia</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DA" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatPrice(Number(value) * 100)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8E3DA' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#1C1C1C" strokeWidth={2} dot={{ fill: '#C4A265', r: 4 }} name="Faturação" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Top Services + Revenue per Staff */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Serviços Mais Marcados</p>
            {topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">Sem dados no período.</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={topServices} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2}>
                        {topServices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {topServices.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs font-medium flex-1 truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{s.count}x</span>
                      <span className="text-xs font-semibold tabular-nums">{formatPrice(s.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Faturação por Colaborador</p>
            {staffData.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">Sem dados no período.</p>
            ) : (
              <div className="space-y-3">
                {staffData.map((s) => {
                  const maxRevenue = staffData[0]?.revenue || 1
                  const pct = Math.round((s.revenue / maxRevenue) * 100)
                  return (
                    <div key={s.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border border-border">
                            <AvatarFallback style={{ backgroundColor: s.color, color: 'white' }} className="text-[9px] font-bold">
                              {s.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground">{s.count} serviços</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums">{formatPrice(s.revenue)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart: 6-Month Trend */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Tendência — Últimos 6 Meses</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DA" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8E3DA' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="bookings" fill="#C4A265" radius={[4, 4, 0, 0]} name="Marcações" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#1C1C1C" strokeWidth={2} dot={{ fill: '#1C1C1C', r: 3 }} name="Faturação (€)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
