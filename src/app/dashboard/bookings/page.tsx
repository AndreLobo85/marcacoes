'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking, BookingService, BookingAssignment, StaffProfile, Customer } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  completed: { label: 'Concluída', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  no_show: { label: 'Não compareceu', variant: 'destructive' },
}

interface EnrichedBooking extends Booking {
  servicesSummary: string
  staffSummary: string
  customer_name: string
  customer_phone: string | null
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([])
  const [filter, setFilter] = useState<string>('pending')

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .single()
    if (!biz) return

    let query = supabase
      .from('bookings')
      .select('*')
      .eq('business_id', biz.id)
      .order('starts_at', { ascending: filter === 'upcoming' })

    if (filter === 'pending') {
      query = query.eq('status', 'pending').order('starts_at', { ascending: true })
    } else if (filter === 'upcoming') {
      query = query.gte('starts_at', new Date().toISOString()).neq('status', 'cancelled')
    } else if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('starts_at', today + 'T00:00:00').lt('starts_at', today + 'T23:59:59')
    } else if (filter === 'past') {
      query = query.lt('starts_at', new Date().toISOString())
    }

    const { data: rawBookings } = await query
    if (!rawBookings || rawBookings.length === 0) {
      setBookings([])
      return
    }

    const bookingIds = rawBookings.map((b) => b.id)

    const [
      { data: bookingServices },
      { data: assignments },
      { data: staffProfiles },
      { data: customers },
    ] = await Promise.all([
      supabase.from('booking_services').select('*').in('booking_id', bookingIds),
      supabase.from('booking_assignments').select('*'),
      supabase.from('staff_profiles').select('*').eq('business_id', biz.id),
      supabase.from('customers').select('*').eq('business_id', biz.id),
    ])

    const staffMap = new Map((staffProfiles || []).map((s: StaffProfile) => [s.id, s]))
    const customerMap = new Map((customers || []).map((c: Customer) => [c.id, c]))

    // Group booking_services by booking_id
    const bsMap = new Map<string, BookingService[]>()
    for (const bs of (bookingServices || []) as BookingService[]) {
      const list = bsMap.get(bs.booking_id) || []
      list.push(bs)
      bsMap.set(bs.booking_id, list)
    }

    // Map assignments by booking_service_id
    const assignMap = new Map<string, BookingAssignment>()
    for (const a of (assignments || []) as BookingAssignment[]) {
      assignMap.set(a.booking_service_id, a)
    }

    setBookings(rawBookings.map((b) => {
      const bServices = bsMap.get(b.id) || []
      const serviceNames = bServices.map((bs) => bs.service_name)
      const staffNames = bServices.map((bs) => {
        const assign = assignMap.get(bs.id)
        return assign ? staffMap.get(assign.staff_id)?.name || '—' : '—'
      })

      const customer = customerMap.get(b.customer_id)

      return {
        ...b,
        servicesSummary: serviceNames.join(', ') || '—',
        staffSummary: [...new Set(staffNames)].join(', ') || '—',
        customer_name: customer?.name || '—',
        customer_phone: customer?.phone || null,
      } as EnrichedBooking
    }))
  }, [supabase, filter])

  useEffect(() => { loadData() }, [loadData])

  async function confirmBooking(bookingId: string) {
    if (!confirm('Confirmar esta marcação? O cliente será notificado.')) return
    const res = await fetch(`/api/internal/bookings/${bookingId}/confirm`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Erro ao aprovar'); return }
    toast.success('Marcação aprovada — email de confirmação enviado ao cliente')
    loadData()
  }

  async function updateStatus(bookingId: string, status: string) {
    const update: Record<string, unknown> = { status }
    if (status === 'cancelled') update.cancelled_at = new Date().toISOString()

    const { error } = await supabase.from('bookings').update(update).eq('id', bookingId)
    if (error) { toast.error(error.message); return }
    toast.success('Estado atualizado')
    loadData()
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all bookings and appointments.</p>
        </div>
        <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="upcoming">Próximas</SelectItem>
            <SelectItem value="past">Passadas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Sem marcações para mostrar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Data/Hora</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Cliente</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Serviços</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Equipa</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Total</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Estado</TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.15em] font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const statusInfo = STATUS_LABELS[b.status] || STATUS_LABELS.pending
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDateTime(b.starts_at)}
                    </TableCell>
                    <TableCell>
                      <div>{b.customer_name}</div>
                      {b.customer_phone && (
                        <div className="text-xs text-muted-foreground">{b.customer_phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{b.servicesSummary}</TableCell>
                    <TableCell>{b.staffSummary}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatPrice(b.total_price_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {b.status === 'pending' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => confirmBooking(b.id)}
                            >
                              Aprovar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => updateStatus(b.id, 'cancelled')}
                            >
                              Rejeitar
                            </Button>
                          </>
                        )}
                        {b.status === 'confirmed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatus(b.id, 'completed')}
                            >
                              Concluir
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => updateStatus(b.id, 'cancelled')}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
