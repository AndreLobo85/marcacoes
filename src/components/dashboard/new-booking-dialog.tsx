'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Service, StaffProfile, StaffService, Customer, Business } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, Plus, X, Clock, CalendarCheck, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'

interface NewBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  business: Business
  onCreated: () => void
}

interface SelectedServiceItem {
  service: Service
  staff: StaffProfile
}

function formatPrice(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100)
}

export function NewBookingDialog({ open, onOpenChange, business, onCreated }: NewBookingDialogProps) {
  const [step, setStep] = useState<'customer' | 'services' | 'datetime' | 'confirm'>('customer')
  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<StaffProfile[]>([])
  const [staffServices, setStaffServices] = useState<StaffService[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Customer
  const [customerMode, setCustomerMode] = useState<'search' | 'new'>('search')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' })

  // Services
  const [selectedItems, setSelectedItems] = useState<SelectedServiceItem[]>([])
  const [pickingServiceId, setPickingServiceId] = useState<string | null>(null)

  // DateTime
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([])
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [{ data: svcData }, { data: staffData }, { data: ssData }, { data: custData }] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', business.id).eq('is_active', true).order('sort_order'),
      supabase.from('staff_profiles').select('*').eq('business_id', business.id).eq('is_active', true).order('sort_order'),
      supabase.from('staff_services').select('*'),
      supabase.from('customers').select('*').eq('business_id', business.id).order('name'),
    ])
    setServices((svcData || []) as Service[])
    setStaffList((staffData || []) as StaffProfile[])
    setStaffServices((ssData || []) as StaffService[])
    setCustomers((custData || []) as Customer[])
  }, [supabase, business.id])

  useEffect(() => {
    if (open) {
      loadData()
      resetForm()
    }
  }, [open, loadData])

  function resetForm() {
    setStep('customer')
    setCustomerMode('search')
    setCustomerSearch('')
    setSelectedCustomer(null)
    setNewCustomer({ name: '', email: '', phone: '' })
    setSelectedItems([])
    setPickingServiceId(null)
    setSelectedDate('')
    setSlots([])
    setSelectedSlot(null)
    setNotes('')
  }

  // Customer search
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  ).slice(0, 8)

  function getEligibleStaff(serviceId: string): StaffProfile[] {
    const ids = staffServices.filter((ss) => ss.service_id === serviceId).map((ss) => ss.staff_id)
    return staffList.filter((s) => ids.includes(s.id))
  }

  function addServiceItem(service: Service, staff: StaffProfile) {
    setSelectedItems((prev) => [...prev, { service, staff }])
    setPickingServiceId(null)
  }

  function removeItem(index: number) {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totalPrice = selectedItems.reduce((sum, item) => sum + item.service.price_cents, 0)
  const totalDuration = selectedItems.reduce((sum, item) => sum + item.service.duration_minutes, 0)

  // Fetch availability
  async function fetchSlots(date: string) {
    if (selectedItems.length === 0) return
    setSelectedDate(date)
    setLoadingSlots(true)
    setSelectedSlot(null)

    const firstItem = selectedItems[0]
    const res = await fetch(
      `/api/public/${business.slug}/availability?staff_id=${firstItem.staff.id}&service_id=${firstItem.service.id}&date=${date}`
    )
    const data = await res.json()
    setSlots(data.slots || [])
    setLoadingSlots(false)
  }

  // Submit booking
  async function handleSubmit() {
    if (selectedItems.length === 0 || !selectedSlot || !selectedDate) return
    setSubmitting(true)

    const customerName = selectedCustomer?.name || newCustomer.name
    const customerEmail = selectedCustomer?.email || newCustomer.email || null
    const customerPhone = selectedCustomer?.phone || newCustomer.phone || null

    if (!customerName) {
      toast.error('Nome do cliente é obrigatório')
      setSubmitting(false)
      return
    }

    const res = await fetch(`/api/public/${business.slug}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        customerName,
        customerEmail,
        customerPhone,
        services: selectedItems.map((item) => ({
          serviceId: item.service.id,
          staffId: item.staff.id,
        })),
        date: selectedDate,
        startTime: selectedSlot.start,
        notes: notes || undefined,
        timezone: business.timezone,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Erro ao criar marcação')
      setSubmitting(false)
      return
    }

    toast.success('Marcação criada com sucesso')
    setSubmitting(false)
    onOpenChange(false)
    onCreated()
  }

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Hoje'
    if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã'
    return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const canProceedFromCustomer = selectedCustomer !== null || newCustomer.name.length > 0
  const canProceedFromServices = selectedItems.length > 0
  const canProceedFromDatetime = selectedSlot !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Nova Marcação</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Passo {step === 'customer' ? '1' : step === 'services' ? '2' : step === 'datetime' ? '3' : '4'} de 4 — {
              step === 'customer' ? 'Cliente' : step === 'services' ? 'Serviços' : step === 'datetime' ? 'Data & Hora' : 'Confirmar'
            }
          </p>
        </DialogHeader>

        {/* Step 1: Customer */}
        {step === 'customer' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={customerMode === 'search' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setCustomerMode('search'); setSelectedCustomer(null) }}
                className="gap-1.5 text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                Cliente Existente
              </Button>
              <Button
                variant={customerMode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setCustomerMode('new'); setSelectedCustomer(null) }}
                className="gap-1.5 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Novo Cliente
              </Button>
            </div>

            {customerMode === 'search' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome, email ou telefone..."
                    className="pl-9 bg-background"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }}
                  />
                </div>

                {customerSearch.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3 text-center italic">
                        Nenhum cliente encontrado.
                        <button className="text-accent font-medium ml-1 hover:underline" onClick={() => { setCustomerMode('new'); setNewCustomer({ ...newCustomer, name: customerSearch }) }}>
                          Criar novo?
                        </button>
                      </p>
                    ) : (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCustomer(c)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                            selectedCustomer?.id === c.id ? 'bg-accent/10 border border-accent/30' : 'hover:bg-secondary'
                          }`}
                        >
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarFallback className="bg-secondary text-[10px] font-semibold">
                              {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">{c.email || c.phone || '—'}</p>
                          </div>
                          {selectedCustomer?.id === c.id && (
                            <Badge variant="secondary" className="text-[9px]">Selecionado</Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-accent/30">
                      <AvatarFallback className="bg-accent text-white text-xs font-semibold">
                        {selectedCustomer.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{selectedCustomer.name}</p>
                      <p className="text-[11px] text-muted-foreground">{[selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {customerMode === 'new' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider font-medium">Nome *</Label>
                  <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider font-medium">Email</Label>
                    <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider font-medium">Telefone</Label>
                    <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="bg-background" />
                  </div>
                </div>
              </div>
            )}

            <Button onClick={() => setStep('services')} disabled={!canProceedFromCustomer} className="w-full uppercase tracking-wider text-xs">
              Continuar — Escolher Serviços
            </Button>
          </div>
        )}

        {/* Step 2: Services */}
        {step === 'services' && (
          <div className="space-y-4">
            {/* Selected items */}
            {selectedItems.length > 0 && (
              <div className="space-y-1.5">
                {selectedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback style={{ backgroundColor: item.staff.color, color: 'white' }} className="text-[8px] font-bold">
                          {item.staff.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{item.service.name}</span>
                      <span className="text-[11px] text-muted-foreground">· {item.staff.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{formatPrice(item.service.price_cents, item.service.currency)}</span>
                      <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold px-3 pt-1">
                  <span><Clock className="inline h-3.5 w-3.5 mr-1" />{totalDuration} min</span>
                  <span>{formatPrice(totalPrice, business.currency)}</span>
                </div>
              </div>
            )}

            {/* Service picker */}
            {pickingServiceId === null ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer hover:bg-secondary transition-colors"
                    onClick={() => {
                      const eligible = getEligibleStaff(s.id)
                      if (eligible.length === 1) addServiceItem(s, eligible[0])
                      else setPickingServiceId(s.id)
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{s.duration_minutes} min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{formatPrice(s.price_cents, s.currency)}</span>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Escolhe o profissional:</p>
                {getEligibleStaff(pickingServiceId).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-secondary transition-colors"
                    onClick={() => addServiceItem(services.find((s) => s.id === pickingServiceId)!, p)}
                  >
                    <Avatar className="h-7 w-7">
                      {p.avatar_url ? <AvatarImage src={p.avatar_url} className="object-cover" /> : null}
                      <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }} className="text-[9px] font-bold">
                        {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPickingServiceId(null)}>
                  ← Voltar
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setStep('customer')}>Voltar</Button>
              <Button onClick={() => setStep('datetime')} disabled={!canProceedFromServices} className="flex-1 uppercase tracking-wider text-xs">
                Continuar — Data & Hora
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: DateTime */}
        {step === 'datetime' && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dates.map((d) => (
                <Button
                  key={d}
                  variant={selectedDate === d ? 'default' : 'outline'}
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => fetchSlots(d)}
                >
                  {formatDateLabel(d)}
                </Button>
              ))}
            </div>

            {selectedDate && (
              <div>
                {loadingSlots ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">A carregar horários...</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center italic">Sem horários disponíveis.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                    {slots.map((slot) => (
                      <Button
                        key={slot.start}
                        variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.start}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider font-medium">Notas (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-background text-sm" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setStep('services')}>Voltar</Button>
              <Button onClick={() => setStep('confirm')} disabled={!canProceedFromDatetime} className="flex-1 uppercase tracking-wider text-xs">
                Continuar — Confirmar
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary/50 p-4 space-y-3 text-sm">
              {/* Customer */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16">Cliente</span>
                <span className="font-medium">{selectedCustomer?.name || newCustomer.name}</span>
              </div>

              {/* Services */}
              {selectedItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16 ${i > 0 ? 'invisible' : ''}`}>Serviços</span>
                    <span>{item.service.name} <span className="text-muted-foreground">com {item.staff.name}</span></span>
                  </div>
                  <span className="font-semibold">{formatPrice(item.service.price_cents, item.service.currency)}</span>
                </div>
              ))}

              {/* DateTime */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16">Data</span>
                <span>
                  {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' às '}{selectedSlot?.start}
                </span>
              </div>

              {/* Total */}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total ({totalDuration} min)</span>
                <span>{formatPrice(totalPrice, business.currency)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setStep('datetime')}>Voltar</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 gap-2 bg-accent hover:bg-gold-dark text-white uppercase tracking-wider text-xs"
              >
                <CalendarCheck className="h-4 w-4" />
                {submitting ? 'A criar...' : 'Criar Marcação'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
