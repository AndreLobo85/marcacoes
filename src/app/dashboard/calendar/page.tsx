'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import type { StaffProfile, Booking, BookingService, BookingAssignment, Customer } from '@/types/database'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function CalendarPage() {
  const [events, setEvents] = useState<EventInput[]>([])
  const [allEvents, setAllEvents] = useState<EventInput[]>([])
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([])
  const [filterStaffId, setFilterStaffId] = useState<string>('all')
  const calendarRef = useRef<FullCalendar>(null)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user.id).single()
    if (!biz) return

    const [{ data: staffData }, { data: bookings }, { data: customers }] = await Promise.all([
      supabase.from('staff_profiles').select('*').eq('business_id', biz.id).eq('is_active', true),
      supabase.from('bookings').select('*').eq('business_id', biz.id).neq('status', 'cancelled'),
      supabase.from('customers').select('*').eq('business_id', biz.id),
    ])

    const staffList = (staffData || []) as StaffProfile[]
    setStaffProfiles(staffList)
    const staffMap = new Map(staffList.map((s) => [s.id, s]))
    const customerMap = new Map((customers || []).map((c: Customer) => [c.id, c]))

    if (!bookings || bookings.length === 0) { setEvents([]); return }
    const bookingIds = bookings.map((b: Booking) => b.id)

    const [{ data: bsData }, { data: assignData }] = await Promise.all([
      supabase.from('booking_services').select('*').in('booking_id', bookingIds),
      supabase.from('booking_assignments').select('*'),
    ])

    const bsMap = new Map<string, BookingService>()
    for (const bs of (bsData || []) as BookingService[]) bsMap.set(bs.id, bs)
    const bookingMap = new Map(bookings.map((b: Booking) => [b.id, b]))

    const calEvents: EventInput[] = ((assignData || []) as BookingAssignment[]).map((a) => {
      const bs = bsMap.get(a.booking_service_id)
      if (!bs) return null
      const booking = bookingMap.get(bs.booking_id)
      const staffMember = staffMap.get(a.staff_id)
      const customer = booking ? customerMap.get(booking.customer_id) : null

      return {
        id: a.id,
        title: `${customer?.name || 'Cliente'} — ${bs.service_name}`,
        start: a.starts_at,
        end: a.ends_at,
        backgroundColor: staffMember?.color || '#C4A265',
        borderColor: staffMember?.color || '#C4A265',
        extendedProps: {
          staffId: a.staff_id,
          staff: staffMember?.name,
          service: bs.service_name,
          customer: customer?.name,
          status: booking?.status,
        },
      }
    }).filter(Boolean) as EventInput[]

    setAllEvents(calEvents)
    setEvents(calEvents)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Filter events by staff
  useEffect(() => {
    if (filterStaffId === 'all') {
      setEvents(allEvents)
    } else {
      setEvents(allEvents.filter((e) => e.extendedProps?.staffId === filterStaffId))
    }
  }, [filterStaffId, allEvents])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage all appointments.</p>
        </div>
      </div>

      {/* Staff filter */}
      {staffProfiles.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStaffId('all')}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
              filterStaffId === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-accent/40'
            }`}
          >
            Todos
          </button>
          {staffProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterStaffId(p.id)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                filterStaffId === p.id ? 'border-2 shadow-sm' : 'border-border hover:border-accent/40'
              }`}
              style={filterStaffId === p.id ? { borderColor: p.color, backgroundColor: p.color + '10' } : {}}
            >
              <Avatar className="h-5 w-5 border border-border">
                {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.name} className="object-cover" /> : null}
                <AvatarFallback style={{ backgroundColor: p.color, color: 'white' }} className="text-[7px] font-bold">
                  {p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
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
          buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }}
        />
      </div>
    </div>
  )
}
