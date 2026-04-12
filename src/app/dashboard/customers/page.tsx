'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserBusinessClient } from '@/lib/get-user-business-client'
import type { Customer, Booking, BookingService, BookingAssignment, StaffProfile, Business } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, Users, Phone, Mail, CalendarCheck, Euro, Plus, Cake, Save, X, ArrowUpDown } from 'lucide-react'
import { NewBookingDialog } from '@/components/dashboard/new-booking-dialog'
import { toast } from 'sonner'

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

interface EnrichedCustomer extends Customer {
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  noShows: number
  totalSpentCents: number
  lastVisit: string | null
  topServices: string[]
}

interface BookingHistoryEntry {
  id: string
  date: string
  serviceName: string
  staffName: string
  priceCents: number
  status: string
  notes: string | null
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<EnrichedCustomer[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'bookings' | 'spent' | 'lastVisit'>('bookings')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bookingHistory, setBookingHistory] = useState<BookingHistoryEntry[]>([])
  const [editingNotes, setEditingNotes] = useState(false)
  const [editingBirthday, setEditingBirthday] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [birthdayValue, setBirthdayValue] = useState('')
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)

  // Raw data for history building
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [allBs, setAllBs] = useState<BookingService[]>([])
  const [allAssignments, setAllAssignments] = useState<BookingAssignment[]>([])
  const [staffList, setStaffList] = useState<StaffProfile[]>([])

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { user, business: biz } = await getUserBusinessClient(supabase)
    if (!user || !biz) return
    if (!biz) return
    setBusiness(biz as Business)

    const [{ data: custData }, { data: bookData }, { data: bsData }, { data: assignData }, { data: staffData }] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', biz.id).order('name'),
      supabase.from('bookings').select('*').eq('business_id', biz.id),
      supabase.from('booking_services').select('*'),
      supabase.from('booking_assignments').select('*'),
      supabase.from('staff_profiles').select('*').eq('business_id', biz.id),
    ])

    const bookings = (bookData || []) as Booking[]
    const bs = (bsData || []) as BookingService[]
    const assignments = (assignData || []) as BookingAssignment[]

    setAllBookings(bookings)
    setAllBs(bs)
    setAllAssignments(assignments)
    setStaffList((staffData || []) as StaffProfile[])

    const bsByBooking = new Map<string, BookingService[]>()
    for (const b of bs) { const l = bsByBooking.get(b.booking_id) || []; l.push(b); bsByBooking.set(b.booking_id, l) }

    const enriched: EnrichedCustomer[] = ((custData || []) as Customer[]).map((c) => {
      const cb = bookings.filter((b) => b.customer_id === c.id)
      const completed = cb.filter((b) => b.status === 'completed' || b.status === 'confirmed')
      const serviceCounts = new Map<string, number>()
      for (const b of cb) { for (const s of (bsByBooking.get(b.id) || [])) { serviceCounts.set(s.service_name, (serviceCounts.get(s.service_name) || 0) + 1) } }

      const sorted = [...completed].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      return {
        ...c,
        totalBookings: cb.filter((b) => b.status !== 'cancelled').length,
        completedBookings: cb.filter((b) => b.status === 'completed').length,
        cancelledBookings: cb.filter((b) => b.status === 'cancelled').length,
        noShows: cb.filter((b) => b.status === 'no_show').length,
        totalSpentCents: completed.reduce((sum, b) => sum + b.total_price_cents, 0),
        lastVisit: sorted[0]?.starts_at || null,
        topServices: [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
      }
    })

    setCustomers(enriched)
    if (!selectedId && enriched.length > 0) setSelectedId(enriched[0].id)
  }, [supabase, selectedId])

  useEffect(() => { loadData() }, [loadData])

  // Build history when selected changes
  useEffect(() => {
    if (!selectedId) { setBookingHistory([]); return }
    const assignByBsId = new Map(allAssignments.map((a) => [a.booking_service_id, a]))
    const staffMap = new Map(staffList.map((s) => [s.id, s]))

    const custBookings = allBookings.filter((b) => b.customer_id === selectedId)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))

    const history: BookingHistoryEntry[] = []
    for (const b of custBookings) {
      const lines = allBs.filter((bs) => bs.booking_id === b.id)
      for (const bs of lines) {
        const assign = assignByBsId.get(bs.id)
        const staffMember = assign ? staffMap.get(assign.staff_id) : null
        history.push({
          id: bs.id,
          date: b.starts_at,
          serviceName: bs.service_name,
          staffName: staffMember?.name || '—',
          priceCents: bs.price_cents,
          status: b.status,
          notes: b.notes,
        })
      }
    }
    setBookingHistory(history)
  }, [selectedId, allBookings, allBs, allAssignments, staffList])

  // Sorting
  const sorted = [...customers].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'bookings': return b.totalBookings - a.totalBookings
      case 'spent': return b.totalSpentCents - a.totalSpentCents
      case 'lastVisit': return (b.lastVisit || '').localeCompare(a.lastVisit || '')
      default: return 0
    }
  })

  const filtered = sorted.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  const selected = customers.find((c) => c.id === selectedId)

  async function saveNotes() {
    if (!selectedId) return
    await supabase.from('customers').update({ notes: notesValue || null }).eq('id', selectedId)
    toast.success('Notas guardadas')
    setEditingNotes(false)
    loadData()
  }

  async function saveBirthday() {
    if (!selectedId) return
    await supabase.from('customers').update({ birthday_date: birthdayValue || null }).eq('id', selectedId)
    toast.success('Aniversário guardado')
    setEditingBirthday(false)
    loadData()
  }

  const totalClients = customers.length
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpentCents, 0)
  const avgSpent = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0

  const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendente', variant: 'outline' },
    confirmed: { label: 'Confirmada', variant: 'default' },
    completed: { label: 'Concluída', variant: 'secondary' },
    cancelled: { label: 'Cancelada', variant: 'destructive' },
    no_show: { label: 'Falta', variant: 'destructive' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Client Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">All clients who have booked with your business.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><Users className="h-4 w-4 text-muted-foreground" /></div><div><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Total Clientes</p><p className="text-xl font-serif font-bold">{totalClients}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><Euro className="h-4 w-4 text-muted-foreground" /></div><div><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Receita Total</p><p className="text-xl font-serif font-bold">{formatPrice(totalRevenue)}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><CalendarCheck className="h-4 w-4 text-muted-foreground" /></div><div><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Gasto Médio</p><p className="text-xl font-serif font-bold">{formatPrice(avgSpent)}</p></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left: Client list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar clientes..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{filtered.length} clientes</p>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-36 h-7 text-[10px]">
                <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bookings">Marcações</SelectItem>
                <SelectItem value="spent">Total Gasto</SelectItem>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="lastVisit">Última Visita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
            {filtered.map((c) => (
              <Card key={c.id} className={`cursor-pointer transition-all ${selectedId === c.id ? 'border-accent/40 shadow-md' : 'hover:shadow-sm'}`} onClick={() => { setSelectedId(c.id); setEditingNotes(false); setEditingBirthday(false) }}>
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarFallback className="bg-secondary text-foreground text-[10px] font-semibold">
                      {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.totalBookings} marcações · {formatPrice(c.totalSpentCents)}</p>
                  </div>
                  {c.totalBookings >= 5 && <span className="badge-gold">Fiel</span>}
                  {c.noShows > 0 && <Badge variant="destructive" className="text-[9px]">{c.noShows} faltas</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: Client detail */}
        {selected ? (
          <div className="space-y-5">
            {/* Profile header */}
            <div className="flex items-start gap-5">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarFallback className="bg-accent text-white text-2xl font-bold">
                  {selected.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-serif text-2xl font-bold tracking-tight">{selected.name}</h2>
                <div className="mt-1.5 space-y-0.5">
                  {selected.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5 text-accent" />{selected.email}</p>}
                  {selected.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5 text-accent" />{selected.phone}</p>}
                  {selected.birthday_date && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Cake className="h-3.5 w-3.5 text-accent" />{new Date(selected.birthday_date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}</p>}
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">
                  Cliente desde {new Date(selected.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </p>
                <Button onClick={() => setBookingDialogOpen(true)} className="mt-3 gap-2 bg-accent hover:bg-[#D4B87A] text-white uppercase tracking-wider text-xs" size="sm">
                  <Plus className="h-3.5 w-3.5" />Nova Marcação
                </Button>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid gap-3 sm:grid-cols-4">
              <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Marcações</p><p className="text-xl font-serif font-bold mt-0.5">{selected.totalBookings}</p></CardContent></Card>
              <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Concluídas</p><p className="text-xl font-serif font-bold mt-0.5 text-emerald-600">{selected.completedBookings}</p></CardContent></Card>
              <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Canceladas</p><p className="text-xl font-serif font-bold mt-0.5 text-amber-600">{selected.cancelledBookings}</p></CardContent></Card>
              <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Faltas</p><p className="text-xl font-serif font-bold mt-0.5 text-red-600">{selected.noShows}</p></CardContent></Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Total spent + last visit */}
              <Card><CardContent className="pt-4 pb-4"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Total Gasto</p><p className="text-2xl font-serif font-bold mt-1">{formatPrice(selected.totalSpentCents)}</p></CardContent></Card>
              <Card><CardContent className="pt-4 pb-4"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Última Visita</p><p className="text-2xl font-serif font-bold mt-1">{selected.lastVisit ? new Date(selected.lastVisit).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p></CardContent></Card>
            </div>

            {/* Top services */}
            {selected.topServices.length > 0 && (
              <Card><CardContent className="pt-4 pb-4"><p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">Serviços Frequentes</p><div className="flex flex-wrap gap-1.5">{selected.topServices.map((name, i) => (<Badge key={i} variant="secondary" className="text-[10px] uppercase tracking-wider font-medium rounded-full px-3 py-1">{name}</Badge>))}</div></CardContent></Card>
            )}

            {/* Birthday + Notes (inline editable) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold flex items-center gap-1"><Cake className="h-3 w-3" />Aniversário</p>
                    {!editingBirthday && <button onClick={() => { setEditingBirthday(true); setBirthdayValue(selected.birthday_date || '') }} className="text-[10px] text-accent font-medium hover:underline">Editar</button>}
                  </div>
                  {editingBirthday ? (
                    <div className="flex gap-2">
                      <Input type="date" value={birthdayValue} onChange={(e) => setBirthdayValue(e.target.value)} className="bg-background h-8 text-sm flex-1" />
                      <Button size="sm" className="h-8 px-2" onClick={saveBirthday}><Save className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingBirthday(false)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <p className="text-sm">{selected.birthday_date ? new Date(selected.birthday_date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }) : <span className="text-muted-foreground italic">Não definido</span>}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Notas</p>
                    {!editingNotes && <button onClick={() => { setEditingNotes(true); setNotesValue(selected.notes || '') }} className="text-[10px] text-accent font-medium hover:underline">Editar</button>}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={2} className="bg-background text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={saveNotes}>Guardar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNotes(false)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{selected.notes || <span className="text-muted-foreground italic">Sem notas</span>}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Booking History */}
            <Card>
              <CardContent className="pt-5 pb-2">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-3">Histórico de Marcações</p>
                {bookingHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic pb-3">Sem histórico.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Data</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Serviço</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Profissional</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Preço</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookingHistory.slice(0, 20).map((h) => {
                        const st = STATUS_LABELS[h.status] || STATUS_LABELS.pending
                        return (
                          <TableRow key={h.id}>
                            <TableCell className="text-xs tabular-nums">{new Date(h.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}</TableCell>
                            <TableCell className="text-xs font-medium">{h.serviceName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{h.staffName}</TableCell>
                            <TableCell className="text-xs tabular-nums font-medium">{formatPrice(h.priceCents)}</TableCell>
                            <TableCell><Badge variant={st.variant} className="text-[9px]">{st.label}</Badge></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card><CardContent className="py-16 text-center"><p className="text-muted-foreground font-serif italic">Seleciona um cliente para ver o detalhe.</p></CardContent></Card>
        )}
      </div>

      {business && <NewBookingDialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen} business={business} onCreated={loadData} />}
    </div>
  )
}
