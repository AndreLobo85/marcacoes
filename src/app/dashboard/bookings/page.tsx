'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Booking, Service, Professional, Customer } from '@/types/database'
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
  service_name: string
  professional_name: string
  customer_name: string
  customer_phone: string | null
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([])
  const [filter, setFilter] = useState<string>('upcoming')

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
      .order('start_time', { ascending: filter === 'upcoming' })

    if (filter === 'upcoming') {
      query = query.gte('start_time', new Date().toISOString()).neq('status', 'cancelled')
    } else if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('start_time', today + 'T00:00:00').lt('start_time', today + 'T23:59:59')
    } else if (filter === 'past') {
      query = query.lt('start_time', new Date().toISOString())
    }

    const [{ data: rawBookings }, { data: services }, { data: professionals }, { data: customers }] = await Promise.all([
      query,
      supabase.from('services').select('*').eq('business_id', biz.id),
      supabase.from('professionals').select('*').eq('business_id', biz.id),
      supabase.from('customers').select('*').eq('business_id', biz.id),
    ])

    const serviceMap = new Map((services || []).map(s => [s.id, s]))
    const profMap = new Map((professionals || []).map(p => [p.id, p]))
    const customerMap = new Map((customers || []).map(c => [c.id, c]))

    setBookings((rawBookings || []).map(b => ({
      ...b,
      service_name: serviceMap.get(b.service_id)?.name || '—',
      professional_name: profMap.get(b.professional_id)?.name || '—',
      customer_name: customerMap.get(b.customer_id)?.name || '—',
      customer_phone: customerMap.get(b.customer_id)?.phone || null,
    })))
  }, [supabase, filter])

  useEffect(() => { loadData() }, [loadData])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marcações</h1>
          <p className="text-muted-foreground">Gere todas as marcações</p>
        </div>
        <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const statusInfo = STATUS_LABELS[b.status] || STATUS_LABELS.pending
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDateTime(b.start_time)}
                    </TableCell>
                    <TableCell>
                      <div>{b.customer_name}</div>
                      {b.customer_phone && (
                        <div className="text-xs text-muted-foreground">{b.customer_phone}</div>
                      )}
                    </TableCell>
                    <TableCell>{b.service_name}</TableCell>
                    <TableCell>{b.professional_name}</TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {b.status === 'confirmed' && (
                        <div className="flex gap-1">
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
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
