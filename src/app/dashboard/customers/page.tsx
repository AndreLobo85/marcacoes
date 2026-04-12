'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer, Booking, BookingService, Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search, Users, Phone, Mail, CalendarCheck, Euro, Plus } from 'lucide-react'
import { NewBookingDialog } from '@/components/dashboard/new-booking-dialog'

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

interface EnrichedCustomer extends Customer {
  totalBookings: number
  completedBookings: number
  totalSpentCents: number
  lastVisit: string | null
  topServices: string[]
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<EnrichedCustomer[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', user.id).single()
    if (!biz) return
    setBusiness(biz as Business)

    const [{ data: custData }, { data: bookingsData }, { data: bsData }] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', biz.id).order('name'),
      supabase.from('bookings').select('*').eq('business_id', biz.id),
      supabase.from('booking_services').select('*'),
    ])

    const allBookings = (bookingsData || []) as Booking[]
    const allBs = (bsData || []) as BookingService[]

    const bsByBooking = new Map<string, BookingService[]>()
    for (const bs of allBs) {
      const list = bsByBooking.get(bs.booking_id) || []
      list.push(bs)
      bsByBooking.set(bs.booking_id, list)
    }

    const enriched: EnrichedCustomer[] = ((custData || []) as Customer[]).map((c) => {
      const custBookings = allBookings.filter((b) => b.customer_id === c.id)
      const completed = custBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed')
      const totalSpentCents = completed.reduce((sum, b) => sum + b.total_price_cents, 0)

      const sorted = [...completed].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      const lastVisit = sorted[0]?.starts_at || null

      // Top services
      const serviceCounts = new Map<string, number>()
      for (const b of custBookings) {
        const lines = bsByBooking.get(b.id) || []
        for (const bs of lines) {
          serviceCounts.set(bs.service_name, (serviceCounts.get(bs.service_name) || 0) + 1)
        }
      }
      const topServices = [...serviceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name)

      return {
        ...c,
        totalBookings: custBookings.filter((b) => b.status !== 'cancelled').length,
        completedBookings: completed.length,
        totalSpentCents,
        lastVisit,
        topServices,
      }
    })

    // Sort: most bookings first
    enriched.sort((a, b) => b.totalBookings - a.totalBookings)
    setCustomers(enriched)
    if (!selectedId && enriched.length > 0) setSelectedId(enriched[0].id)
  }, [supabase, selectedId])

  useEffect(() => { loadData() }, [loadData])

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  const selected = customers.find((c) => c.id === selectedId)

  const totalClients = customers.length
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpentCents, 0)
  const avgSpent = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Client Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All clients who have booked with your business.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Total Clientes</p>
                <p className="text-xl font-serif font-bold">{totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Euro className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Receita Total</p>
                <p className="text-xl font-serif font-bold">{formatPrice(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Gasto Médio</p>
                <p className="text-xl font-serif font-bold">{formatPrice(avgSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left: Client list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar clientes..."
              className="pl-9 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
            {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
          </p>

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-8 text-center">Nenhum cliente encontrado.</p>
            ) : (
              filtered.map((c) => (
                <Card
                  key={c.id}
                  className={`cursor-pointer transition-all ${
                    selectedId === c.id ? 'border-accent/40 shadow-md' : 'hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className="bg-secondary text-foreground text-[10px] font-semibold">
                        {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.totalBookings} marcação{c.totalBookings !== 1 ? 'ões' : ''} · {formatPrice(c.totalSpentCents)}
                      </p>
                    </div>
                    {c.totalBookings >= 5 && (
                      <span className="badge-gold">Fiel</span>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right: Client detail */}
        {selected ? (
          <div className="space-y-6">
            {/* Profile */}
            <div className="flex items-start gap-5">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarFallback className="bg-accent text-white text-2xl font-bold">
                  {selected.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-serif text-2xl font-bold tracking-tight">{selected.name}</h2>
                <div className="mt-2 space-y-1">
                  {selected.email && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-accent" /> {selected.email}
                    </p>
                  )}
                  {selected.phone && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-accent" /> {selected.phone}
                    </p>
                  )}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">
                  Cliente desde {new Date(selected.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </p>
                <Button
                  onClick={() => setBookingDialogOpen(true)}
                  className="mt-3 gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova Marcação
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Marcações</p>
                  <p className="text-2xl font-serif font-bold mt-1">{selected.totalBookings}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Total Gasto</p>
                  <p className="text-2xl font-serif font-bold mt-1">{formatPrice(selected.totalSpentCents)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Última Visita</p>
                  <p className="text-lg font-serif font-bold mt-1">
                    {selected.lastVisit
                      ? new Date(selected.lastVisit).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
                      : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Favourite services */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
                  Serviços Frequentes
                </p>
                {selected.topServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sem histórico de serviços.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selected.topServices.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] uppercase tracking-wider font-medium rounded-full px-3 py-1">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {selected.notes && (
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">
                    Notas
                  </p>
                  <p className="text-sm text-muted-foreground">{selected.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground font-serif italic">Seleciona um cliente para ver o detalhe.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Booking dialog */}
      {business && (
        <NewBookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          business={business}
          onCreated={loadData}
        />
      )}
    </div>
  )
}
