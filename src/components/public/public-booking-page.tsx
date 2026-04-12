'use client'

import { useState, useCallback } from 'react'
import type { Business, Service, StaffProfile, StaffService } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Clock, Check, Scissors } from 'lucide-react'

interface Props {
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

function formatPrice(cents: number, currency = 'EUR', locale = 'pt') {
  return new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', { style: 'currency', currency }).format(cents / 100)
}

function getEligibleStaff(serviceId: string, allStaff: StaffProfile[], ss: StaffService[]): StaffProfile[] {
  const ids = ss.filter((s) => s.service_id === serviceId).map((s) => s.staff_id)
  return allStaff.filter((s) => ids.includes(s.id))
}

export function PublicBookingPage({ slug, business, services, staff, staffServices }: Props) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [pickingStaffFor, setPickingStaffFor] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null)
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const totalPrice = selectedItems.reduce((sum, i) => sum + i.service.price_cents, 0)
  const totalDuration = selectedItems.reduce((sum, i) => sum + i.service.duration_minutes, 0)

  function toggleService(service: Service) {
    const existing = selectedItems.findIndex((i) => i.service.id === service.id)
    if (existing >= 0) {
      setSelectedItems((prev) => prev.filter((_, idx) => idx !== existing))
      return
    }
    const eligible = getEligibleStaff(service.id, staff, staffServices)
    if (eligible.length === 1) {
      setSelectedItems((prev) => [...prev, { service, staff: eligible[0] }])
    } else if (eligible.length > 1) {
      setPickingStaffFor(service.id)
    }
  }

  function selectStaffForService(staffMember: StaffProfile) {
    if (!pickingStaffFor) return
    const service = services.find((s) => s.id === pickingStaffFor)!
    setSelectedItems((prev) => [...prev, { service, staff: staffMember }])
    setPickingStaffFor(null)
  }

  function selectSpecialist(staffId: string) {
    setSelectedStaffId(staffId)
    // Auto-select all services this staff can do if none selected
    if (selectedItems.length === 0) {
      const eligibleServices = staffServices.filter((ss) => ss.staff_id === staffId)
      // Don't auto-add, just highlight
    }
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedItems.length === 0 || !selectedSlot || !selectedDate || !customerForm.name) return
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
        services: selectedItems.map((item) => ({ serviceId: item.service.id, staffId: item.staff.id })),
        date: selectedDate,
        startTime: selectedSlot.start,
        notes: customerForm.notes || undefined,
        timezone: business.timezone,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erro ao criar marcação'); setSubmitting(false); return }
    setSuccess(true)
    setSubmitting(false)
  }

  // Calendar helpers
  const now = new Date()
  const calendarMonth = now.getMonth()
  const calendarYear = now.getFullYear()
  const monthName = now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstDayOfWeek = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7 // Monday=0
  const todayDate = now.getDate()

  const calendarDays: Array<{ day: number; dateStr: string; isPast: boolean }> = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarDays.push({ day: d, dateStr, isPast: d < todayDate })
  }

  const isServiceSelected = (id: string) => selectedItems.some((i) => i.service.id === id)
  const bookingSettings = (business.booking_page_settings || {}) as Record<string, boolean>
  const showPrices = bookingSettings.showPrices !== false

  // Offline page
  if (!business.booking_page_online) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="py-12">
            <h2 className="font-serif text-2xl font-bold mb-2">{business.name}</h2>
            <p className="text-muted-foreground">Marcações online temporariamente indisponíveis.</p>
            {business.phone && <p className="text-sm mt-4">Contacte-nos: {business.phone}</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="py-12">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <Check className="h-8 w-8 text-accent" />
            </div>
            <h2 className="font-serif text-2xl font-bold mb-2">Marcação Enviada!</h2>
            <p className="text-sm text-accent font-medium mb-4">A aguardar confirmação do estabelecimento</p>
            <p className="text-muted-foreground text-sm mb-6">
              {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} às {selectedSlot?.start}
            </p>
            <p className="font-serif text-xl font-bold">{formatPrice(totalPrice, business.currency, business.locale)}</p>
            {customerForm.email && (
              <p className="text-xs text-muted-foreground mt-4">Receberás um email em {customerForm.email} quando for confirmada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between h-14 px-5">
          <span className="font-serif text-sm font-bold italic">{business.name}</span>
          <div className="hidden sm:flex items-center gap-6 text-[11px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
            <a href="#services" className="hover:text-foreground transition-colors">Serviços</a>
            <a href="#specialists" className="hover:text-foreground transition-colors">Equipa</a>
            <a href="#availability" className="hover:text-foreground transition-colors">Disponibilidade</a>
          </div>
          <a href="#services" className="badge-gold cursor-pointer">Marcar</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center bg-[#1C1C1C] overflow-hidden mt-14">
        {/* Cover image or texture */}
        {business.cover_image_url ? (
          <img src={business.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23C4A265\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

        <div className="relative z-10 text-center px-5">
          <h1 className="font-serif text-4xl md:text-6xl font-bold text-white leading-[1.1]">
            Define Your <em className="italic text-[#C4A265]">Prestige</em>
          </h1>
          <p className="mt-4 text-white/70 max-w-md mx-auto text-sm leading-relaxed">
            {business.description || `Marca o teu serviço online em ${business.name}. Sem esperas, sem telefonemas.`}
          </p>
          <a href="#services" className="mt-8 inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 backdrop-blur px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white hover:bg-white/20 transition-colors">
            Book Your Visit
          </a>
        </div>
      </section>

      {/* Main content: services + specialists + availability + sidebar */}
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Left column */}
          <div className="space-y-16">
            {/* STEP 01: Select Services */}
            <section id="services">
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold mb-2">Step 01</p>
              <h2 className="font-serif text-2xl font-bold tracking-tight mb-6">Select Services</h2>

              {/* Staff picker overlay */}
              {pickingStaffFor && (
                <Card className="mb-4 border-accent/30">
                  <CardContent className="py-4">
                    <p className="text-sm font-medium mb-3">Escolhe o profissional para {services.find((s) => s.id === pickingStaffFor)?.name}:</p>
                    <div className="flex gap-3">
                      {getEligibleStaff(pickingStaffFor, staff, staffServices).map((p) => (
                        <button key={p.id} onClick={() => selectStaffForService(p)} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-secondary transition-colors">
                          <Avatar className="h-10 w-10 border border-border">
                            {p.avatar_url ? <AvatarImage src={p.avatar_url} className="object-cover" /> : null}
                            <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }} className="text-xs font-bold">
                              {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] font-medium">{p.name}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setPickingStaffFor(null)} className="text-xs text-muted-foreground mt-2 hover:text-foreground">Cancelar</button>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => {
                  const selected = isServiceSelected(s.id)
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleService(s)}
                      className={`rounded-xl border-2 p-5 cursor-pointer transition-all ${
                        selected
                          ? 'bg-[#1C1C1C] border-[#1C1C1C] text-white shadow-lg'
                          : 'bg-card border-border hover:border-accent/30 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? 'bg-accent' : 'bg-secondary'}`}>
                              <Scissors className={`h-3.5 w-3.5 ${selected ? 'text-white' : 'text-muted-foreground'}`} />
                            </div>
                            <h3 className="font-semibold text-sm">{s.name}</h3>
                          </div>
                          {s.description && (
                            <p className={`text-xs mt-1 line-clamp-2 ${selected ? 'text-white/60' : 'text-muted-foreground'}`}>
                              {s.description}
                            </p>
                          )}
                        </div>
                        {selected && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent shrink-0">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center justify-between mt-4 pt-3 border-t ${selected ? 'border-white/10' : 'border-border'}`}>
                        <span className={`text-xs ${selected ? 'text-white/50' : 'text-muted-foreground'}`}>
                          <Clock className="inline h-3 w-3 mr-1" />{s.duration_minutes} min
                        </span>
                        {showPrices && (
                        <span className={`font-bold text-sm ${selected ? 'text-accent' : ''}`}>
                          {formatPrice(s.price_cents, s.currency, business.locale)}
                        </span>
                      )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* STEP 02: The Specialists */}
            <section id="specialists">
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold mb-2">Step 02</p>
              <h2 className="font-serif text-2xl font-bold tracking-tight mb-6">The Specialists</h2>

              <div className="flex gap-6 overflow-x-auto pb-2">
                {staff.map((p) => {
                  const isSelected = selectedItems.some((i) => i.staff.id === p.id) || selectedStaffId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectSpecialist(p.id)}
                      className={`flex flex-col items-center gap-2 shrink-0 transition-all ${isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <Avatar className={`h-16 w-16 border-2 transition-colors ${isSelected ? 'border-accent shadow-lg' : 'border-border'}`}>
                        {p.avatar_url ? <AvatarImage src={p.avatar_url} className="object-cover" /> : null}
                        <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }} className="text-lg font-bold">
                          {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-center">
                        <p className="text-xs font-semibold">{p.name}</p>
                        {p.bio && <p className="text-[10px] text-muted-foreground italic">{p.bio}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* STEP 03: Select Availability */}
            {selectedItems.length > 0 && (
              <section id="availability">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold mb-2">Step 03</p>
                <h2 className="font-serif text-2xl font-bold tracking-tight mb-6">Select Availability</h2>

                {/* Calendar grid */}
                <div className="mb-6">
                  <p className="text-sm font-semibold capitalize mb-4">{monthName}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {/* Day headers */}
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                      <div key={d} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-2">{d}</div>
                    ))}
                    {/* Empty cells before first day */}
                    {Array.from({ length: firstDayOfWeek }, (_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {/* Day cells */}
                    {calendarDays.map(({ day, dateStr, isPast }) => {
                      const isSelected = selectedDate === dateStr
                      const isToday = day === todayDate
                      return (
                        <button
                          key={day}
                          disabled={isPast}
                          onClick={() => fetchSlots(dateStr)}
                          className={`h-10 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-[#1C1C1C] text-white shadow-md'
                              : isToday
                                ? 'bg-accent text-white'
                                : isPast
                                  ? 'text-muted-foreground/30 cursor-not-allowed'
                                  : 'hover:bg-secondary text-foreground'
                          }`}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div>
                    {loadingSlots ? (
                      <p className="text-sm text-muted-foreground py-4">A carregar horários...</p>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 italic">Sem horários disponíveis neste dia.</p>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {slots.map((slot) => (
                          <button
                            key={slot.start}
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                              selectedSlot?.start === slot.start
                                ? 'bg-accent text-white shadow-md'
                                : 'bg-card border border-border hover:border-accent/40'
                            }`}
                          >
                            {slot.start}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Customer form — shown when slot is selected */}
                {selectedSlot && (
                  <form onSubmit={handleSubmit} className="mt-8 space-y-4 lg:hidden">
                    <h3 className="font-serif text-lg font-bold">Os Teus Dados</h3>
                    {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider font-medium">Nome *</Label>
                      <Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required className="bg-card" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider font-medium">Email</Label>
                        <Input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} className="bg-card" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider font-medium">Telefone</Label>
                        <Input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} className="bg-card" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider font-medium">Notas (opcional)</Label>
                      <Textarea value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} rows={2} className="bg-card" />
                    </div>
                    <Button type="submit" className="w-full bg-[#1C1C1C] hover:bg-[#2a2a2a] text-white uppercase tracking-wider text-xs" size="lg" disabled={submitting}>
                      {submitting ? 'A processar...' : 'Confirm Appointment'}
                    </Button>
                  </form>
                )}
              </section>
            )}
          </div>

          {/* Right: Booking Summary (sticky) */}
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <Card className="shadow-lg border-border">
                <CardContent className="pt-6 pb-6">
                  <h3 className="font-serif text-lg font-bold mb-4">Booking Summary</h3>

                  {selectedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Seleciona serviços para começar.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected services */}
                      <div className="space-y-3">
                        {selectedItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <div>
                              <p className="font-medium">{item.service.name}</p>
                              <p className="text-[11px] text-muted-foreground">{item.staff.name} · {item.service.duration_minutes} min</p>
                            </div>
                            <p className="font-semibold shrink-0">{formatPrice(item.service.price_cents, item.service.currency, business.locale)}</p>
                          </div>
                        ))}
                      </div>

                      {/* Date/time */}
                      {selectedDate && (
                        <div className="border-t border-border pt-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Data</span>
                            <span className="font-medium">
                              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {selectedSlot && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-muted-foreground">Hora</span>
                              <span className="font-medium">{selectedSlot.start}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Totals */}
                      <div className="border-t border-border pt-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Duração</span>
                          <span>{totalDuration} min</span>
                        </div>
                        <div className="flex justify-between text-base font-bold">
                          <span>Total</span>
                          <span className="font-serif">{formatPrice(totalPrice, business.currency, business.locale)}</span>
                        </div>
                      </div>

                      {/* Customer form in sidebar */}
                      {selectedSlot && (
                        <form onSubmit={handleSubmit} className="border-t border-border pt-4 space-y-3">
                          {error && <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div>}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider font-medium">Nome *</Label>
                            <Input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required className="bg-background h-9 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider font-medium">Email</Label>
                            <Input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} className="bg-background h-9 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider font-medium">Telefone</Label>
                            <Input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} className="bg-background h-9 text-sm" />
                          </div>
                          <Button type="submit" className="w-full bg-[#1C1C1C] hover:bg-[#2a2a2a] text-white uppercase tracking-[0.15em] text-[11px]" size="lg" disabled={submitting}>
                            {submitting ? 'A processar...' : 'Confirm Appointment'}
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-8">
        <div className="mx-auto max-w-6xl px-5">
          {business.footer_notes && (
            <p className="text-sm text-muted-foreground mb-4 text-center">{business.footer_notes}</p>
          )}
          <div className="flex items-center justify-between">
            <p className="font-serif italic text-sm">{business.name}</p>
            <div className="flex gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
              {business.social_facebook && <a href={business.social_facebook} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Facebook</a>}
              {business.social_instagram && <a href={business.social_instagram} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Instagram</a>}
              {business.social_website && <a href={business.social_website} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">Website</a>}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
