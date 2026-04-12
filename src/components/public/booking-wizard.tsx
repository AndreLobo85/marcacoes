'use client'

import { useState, useCallback } from 'react'
import type { Business, Service, StaffProfile, StaffService } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CalendarCheck, Clock, ArrowLeft, Check, Plus, X } from 'lucide-react'

// ── Types ──

interface BookingWizardProps {
  slug: string
  business: Business
  services: Service[]
  staff: StaffProfile[]
  staffServices: StaffService[]
}

interface SelectedItem {
  service: Service
  staff: StaffProfile
}

interface TimeSlot {
  start: string
  end: string
  staffId: string
}

type Step = 'services' | 'datetime' | 'details' | 'success'

// ── Helpers ──

function formatPrice(cents: number, currency = 'EUR', locale = 'pt') {
  const resolvedLocale = locale === 'pt' ? 'pt-PT' : 'en-GB'
  return new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency }).format(cents / 100)
}

function getEligibleStaff(
  serviceId: string,
  staff: StaffProfile[],
  staffServices: StaffService[]
): StaffProfile[] {
  const eligibleIds = staffServices
    .filter((ss) => ss.service_id === serviceId)
    .map((ss) => ss.staff_id)
  return staff.filter((s) => eligibleIds.includes(s.id))
}

// ── Component ──

export function BookingWizard({ slug, business, services, staff, staffServices }: BookingWizardProps) {
  const [step, setStep] = useState<Step>('services')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [currentServiceId, setCurrentServiceId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingResult, setBookingResult] = useState<{
    startsAt: string
    services: Array<{ serviceName: string; staffName: string; startsAt: string; endsAt: string }>
  } | null>(null)

  const totalPrice = selectedItems.reduce((sum, item) => sum + item.service.price_cents, 0)
  const totalDuration = selectedItems.reduce((sum, item) => sum + item.service.duration_minutes, 0)

  // Add a service+staff pair
  function addItem(service: Service, staffMember: StaffProfile) {
    setSelectedItems((prev) => [...prev, { service, staff: staffMember }])
    setCurrentServiceId(null)
  }

  function removeItem(index: number) {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index))
  }

  function proceedToDatetime() {
    if (selectedItems.length === 0) return
    setStep('datetime')
  }

  // Fetch availability for the first service's staff (others are sequential)
  const fetchSlots = useCallback(async (date: string) => {
    if (selectedItems.length === 0) return
    setSelectedDate(date)
    setLoadingSlots(true)
    setSelectedSlot(null)

    const firstItem = selectedItems[0]
    const res = await fetch(
      `/api/public/${slug}/availability?staff_id=${firstItem.staff.id}&service_id=${firstItem.service.id}&date=${date}`
    )
    const data = await res.json()
    setSlots(data.slots || [])
    setLoadingSlots(false)
  }, [selectedItems, slug])

  function selectSlot(slot: TimeSlot) {
    setSelectedSlot(slot)
    setStep('details')
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (selectedItems.length === 0 || !selectedSlot || !selectedDate) return
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/public/${slug}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        customerName: customerForm.name,
        customerEmail: customerForm.email || null,
        customerPhone: customerForm.phone || null,
        services: selectedItems.map((item) => ({
          serviceId: item.service.id,
          staffId: item.staff.id,
        })),
        date: selectedDate,
        startTime: selectedSlot.start,
        notes: customerForm.notes || undefined,
        timezone: business.timezone,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao criar marcação')
      setSubmitting(false)
      return
    }

    setBookingResult(data)
    setStep('success')
    setSubmitting(false)
  }

  function goBack() {
    if (step === 'datetime') setStep('services')
    if (step === 'details') setStep('datetime')
  }

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (d.toDateString() === today.toDateString()) return 'Hoje'
    if (d.toDateString() === tomorrow.toDateString()) return 'Amanhã'
    return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // ── Success ──
  if (step === 'success') {
    return (
      <Card className="text-center">
        <CardContent className="py-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Marcação Enviada!</h2>
          <p className="text-sm text-amber-600 font-medium mb-4">
            A aguardar confirmação do estabelecimento
          </p>
          <div className="text-muted-foreground mb-4 space-y-1 text-sm">
            {bookingResult?.services.map((s, i) => (
              <p key={i}>
                {s.serviceName} com {s.staffName}
              </p>
            ))}
          </div>
          <p className="text-muted-foreground mb-6">
            {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', {
              weekday: 'long', day: 'numeric', month: 'long',
            })} às {selectedSlot?.start}
          </p>
          <p className="font-semibold text-lg">
            Total: {formatPrice(totalPrice, business.currency, business.locale)}
          </p>
          {customerForm.email && (
            <p className="text-sm text-muted-foreground mt-4">
              Receberás um email em {customerForm.email} quando a marcação for confirmada.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {step !== 'services' && (
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        )}
        <span>
          Passo {step === 'services' ? '1' : step === 'datetime' ? '2' : '3'} de 3
        </span>
      </div>

      {/* Step 1: Select Services + Staff */}
      {step === 'services' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Escolhe os Serviços</h2>

          {/* Selected items */}
          {selectedItems.length > 0 && (
            <div className="space-y-2">
              {selectedItems.map((item, i) => (
                <Card key={i} className="bg-primary/5 border-primary/20">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback style={{ backgroundColor: item.staff.color, color: 'white' }} className="text-xs">
                          {item.staff.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{item.service.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.staff.name} · {item.service.duration_minutes} min · {formatPrice(item.service.price_cents, item.service.currency, business.locale)}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Total bar */}
              <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {totalDuration} min
                </span>
                <span className="font-semibold">
                  {formatPrice(totalPrice, business.currency, business.locale)}
                </span>
              </div>
            </div>
          )}

          {/* Service selection (if not picking staff for one) */}
          {currentServiceId === null ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {selectedItems.length === 0 ? 'Seleciona pelo menos um serviço:' : 'Adicionar outro serviço:'}
              </p>
              {services.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => {
                    const eligible = getEligibleStaff(s.id, staff, staffServices)
                    if (eligible.length === 1) {
                      addItem(s, eligible[0])
                    } else {
                      setCurrentServiceId(s.id)
                    }
                  }}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      {s.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Clock className="inline h-3 w-3 mr-1" />{s.duration_minutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{formatPrice(s.price_cents, s.currency, business.locale)}</Badge>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Staff picker for the selected service */
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Escolhe o profissional para {services.find((s) => s.id === currentServiceId)?.name}:
              </p>
              {getEligibleStaff(currentServiceId, staff, staffServices).map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => {
                    const service = services.find((s) => s.id === currentServiceId)!
                    addItem(service, p)
                  }}
                >
                  <CardContent className="flex items-center gap-3 py-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }} className="text-xs">
                        {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{p.name}</p>
                  </CardContent>
                </Card>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setCurrentServiceId(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar aos serviços
              </Button>
            </div>
          )}

          {/* Continue button */}
          {selectedItems.length > 0 && currentServiceId === null && (
            <Button className="w-full" size="lg" onClick={proceedToDatetime}>
              Continuar — {selectedItems.length} serviço{selectedItems.length > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 'datetime' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Escolhe Data e Hora</h2>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((d) => (
              <Button
                key={d}
                variant={selectedDate === d ? 'default' : 'outline'}
                size="sm"
                className="shrink-0"
                onClick={() => fetchSlots(d)}
              >
                {formatDateLabel(d)}
              </Button>
            ))}
          </div>

          {selectedDate && (
            <div>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground py-4">A carregar horários...</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Sem horários disponíveis neste dia.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot.start}
                      variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
                      onClick={() => selectSlot(slot)}
                    >
                      {slot.start}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Customer Details */}
      {step === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle>Os Teus Dados</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="mb-6 rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              {selectedItems.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span>{item.service.name} <span className="text-muted-foreground">com {item.staff.name}</span></span>
                  <span>{formatPrice(item.service.price_cents, item.service.currency, business.locale)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total ({totalDuration} min)</span>
                <span>{formatPrice(totalPrice, business.currency, business.locale)}</span>
              </div>
              <p className="text-muted-foreground">
                {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })} às {selectedSlot?.start}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleBook} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                <CalendarCheck className="mr-2 h-5 w-5" />
                {submitting ? 'A confirmar...' : 'Confirmar Marcação'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
