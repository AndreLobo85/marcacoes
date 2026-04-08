'use client'

import { useState } from 'react'
import type { Business, Service, Professional } from '@/types/database'
import type { TimeSlot } from '@/lib/availability'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CalendarCheck, Clock, Euro, ArrowLeft, Check } from 'lucide-react'

interface BookingWizardProps {
  slug: string
  business: Business
  services: Service[]
  professionals: Professional[]
}

type Step = 'service' | 'professional' | 'datetime' | 'details' | 'success'

function formatPrice(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100)
}

export function BookingWizard({ slug, services, professionals }: BookingWizardProps) {
  const [step, setStep] = useState<Step>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function selectService(s: Service) {
    setSelectedService(s)
    setStep('professional')
  }

  function selectProfessional(p: Professional) {
    setSelectedProfessional(p)
    setStep('datetime')
  }

  async function selectDate(date: string) {
    if (!selectedService || !selectedProfessional) return
    setSelectedDate(date)
    setLoadingSlots(true)
    setSelectedSlot(null)

    const res = await fetch(
      `/api/public/${slug}/availability?professional_id=${selectedProfessional.id}&service_id=${selectedService.id}&date=${date}`
    )
    const data = await res.json()
    setSlots(data.slots || [])
    setLoadingSlots(false)
  }

  function selectSlot(slot: TimeSlot) {
    setSelectedSlot(slot)
    setStep('details')
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedService || !selectedProfessional || !selectedSlot || !selectedDate) return
    setSubmitting(true)
    setError(null)

    const startTime = `${selectedDate}T${selectedSlot.start}:00`

    const res = await fetch(`/api/public/${slug}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        professional_id: selectedProfessional.id,
        service_id: selectedService.id,
        start_time: startTime,
        customer_name: customerForm.name,
        customer_email: customerForm.email || null,
        customer_phone: customerForm.phone || null,
        notes: customerForm.notes || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao criar marcação')
      setSubmitting(false)
      return
    }

    setStep('success')
    setSubmitting(false)
  }

  function goBack() {
    if (step === 'professional') setStep('service')
    if (step === 'datetime') setStep('professional')
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

  if (step === 'success') {
    return (
      <Card className="text-center">
        <CardContent className="py-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Marcação Confirmada!</h2>
          <p className="text-muted-foreground mb-6">
            A tua marcação de {selectedService?.name} com {selectedProfessional?.name} está confirmada
            para {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} às {selectedSlot?.start}.
          </p>
          {customerForm.email && (
            <p className="text-sm text-muted-foreground">
              Enviámos uma confirmação para {customerForm.email}
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
        {step !== 'service' && (
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        )}
        <span>
          Passo {step === 'service' ? '1' : step === 'professional' ? '2' : step === 'datetime' ? '3' : '4'} de 4
        </span>
      </div>

      {/* Step 1: Service */}
      {step === 'service' && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Escolhe o Serviço</h2>
          {services.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => selectService(s)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{s.name}</p>
                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {s.duration_minutes} min
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="text-base">
                  {formatPrice(s.price_cents, s.currency)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Professional */}
      {step === 'professional' && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Escolhe o Profissional</h2>
          {professionals.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => selectProfessional(p)}
            >
              <CardContent className="flex items-center gap-3 py-4">
                <Avatar>
                  <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }}>
                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{p.name}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 3: Date & Time */}
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
                onClick={() => selectDate(d)}
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

      {/* Step 4: Customer Details */}
      {step === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle>Os Teus Dados</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="mb-6 rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
              <p><strong>Serviço:</strong> {selectedService?.name} — {selectedService && formatPrice(selectedService.price_cents)}</p>
              <p><strong>Profissional:</strong> {selectedProfessional?.name}</p>
              <p><strong>Data:</strong> {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p><strong>Hora:</strong> {selectedSlot?.start} — {selectedSlot?.end}</p>
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
