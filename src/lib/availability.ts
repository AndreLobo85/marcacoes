import type { WorkingHours, Break, Booking, TimeOff } from '@/types/database'

export interface TimeSlot {
  start: string // HH:mm
  end: string   // HH:mm
}

/**
 * Calculate available time slots for a professional on a given date.
 */
export function getAvailableSlots(params: {
  date: Date
  serviceDuration: number // minutes
  workingHours: WorkingHours[]
  breaks: Break[]
  bookings: Booking[]
  timeOff: TimeOff[]
  slotInterval?: number // minutes, default 15
}): TimeSlot[] {
  const {
    date,
    serviceDuration,
    workingHours,
    breaks,
    bookings,
    timeOff,
    slotInterval = 15,
  } = params

  const dayOfWeek = date.getDay() // 0 = Sunday

  // Check time off
  const dateStr = formatDate(date)
  const hasTimeOff = timeOff.some(
    (to) => dateStr >= to.start_date && dateStr <= to.end_date
  )
  if (hasTimeOff) return []

  // Get working hours for this day
  const dayHours = workingHours.filter(
    (wh) => wh.day_of_week === dayOfWeek && wh.is_active
  )
  if (dayHours.length === 0) return []

  // Get breaks for this day
  const dayBreaks = breaks.filter((b) => b.day_of_week === dayOfWeek)

  // Get active bookings for this date
  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)
  const dateEnd = new Date(date)
  dateEnd.setHours(23, 59, 59, 999)

  const dayBookings = bookings.filter((b) => {
    if (b.status === 'cancelled') return false
    const bStart = new Date(b.start_time)
    return bStart >= dateStart && bStart <= dateEnd
  })

  const slots: TimeSlot[] = []

  for (const wh of dayHours) {
    const startMinutes = timeToMinutes(wh.start_time)
    const endMinutes = timeToMinutes(wh.end_time)

    for (let current = startMinutes; current + serviceDuration <= endMinutes; current += slotInterval) {
      const slotStart = current
      const slotEnd = current + serviceDuration

      // Check break overlap
      const overlapsBreak = dayBreaks.some((b) => {
        const breakStart = timeToMinutes(b.start_time)
        const breakEnd = timeToMinutes(b.end_time)
        return slotStart < breakEnd && slotEnd > breakStart
      })
      if (overlapsBreak) continue

      // Check booking overlap
      const overlapsBooking = dayBookings.some((b) => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        const bookingStartMin = bStart.getHours() * 60 + bStart.getMinutes()
        const bookingEndMin = bEnd.getHours() * 60 + bEnd.getMinutes()
        return slotStart < bookingEndMin && slotEnd > bookingStartMin
      })
      if (overlapsBooking) continue

      slots.push({
        start: minutesToTime(slotStart),
        end: minutesToTime(slotEnd),
      })
    }
  }

  return slots
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
