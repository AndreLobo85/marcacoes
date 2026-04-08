'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import type { Professional, Booking, Service, Customer } from '@/types/database'

export default function CalendarPage() {
  const [events, setEvents] = useState<EventInput[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const calendarRef = useRef<FullCalendar>(null)

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

    const [{ data: profs }, { data: bookings }, { data: services }, { data: customers }] = await Promise.all([
      supabase.from('professionals').select('*').eq('business_id', biz.id).eq('is_active', true),
      supabase.from('bookings').select('*').eq('business_id', biz.id).neq('status', 'cancelled'),
      supabase.from('services').select('*').eq('business_id', biz.id),
      supabase.from('customers').select('*').eq('business_id', biz.id),
    ])

    setProfessionals(profs || [])

    const serviceMap = new Map((services || []).map(s => [s.id, s]))
    const profMap = new Map((profs || []).map(p => [p.id, p]))
    const customerMap = new Map((customers || []).map(c => [c.id, c]))

    const calEvents: EventInput[] = (bookings || []).map((b) => {
      const prof = profMap.get(b.professional_id)
      const svc = serviceMap.get(b.service_id)
      const cust = customerMap.get(b.customer_id)

      return {
        id: b.id,
        title: `${cust?.name || 'Cliente'} — ${svc?.name || 'Serviço'}`,
        start: b.start_time,
        end: b.end_time,
        backgroundColor: prof?.color || '#3b82f6',
        borderColor: prof?.color || '#3b82f6',
        extendedProps: {
          professional: prof?.name,
          service: svc?.name,
          customer: cust?.name,
          status: b.status,
        },
      }
    })

    setEvents(calEvents)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendário</h1>
        <p className="text-muted-foreground">Visualiza todas as marcações</p>
      </div>

      {professionals.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {professionals.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 text-sm">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-lg border p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale="pt"
          firstDay={1}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          events={events}
          height="auto"
          nowIndicator
          eventDisplay="block"
          slotDuration="00:15:00"
          buttonText={{
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
          }}
        />
      </div>
    </div>
  )
}
