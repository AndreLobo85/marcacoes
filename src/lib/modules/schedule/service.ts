import type { BusinessHours, StaffWorkingHours, BlockedSlot, BookingAssignment } from '@/types/database'
import type { AvailabilityParams, AvailabilityResult, TimeSlot } from './types'

const DEFAULT_SLOT_INTERVAL = 15

/**
 * Calculate available time slots for a staff member on a given date.
 *
 * Rules applied (in order):
 * 1. Business must be open on that day_of_week
 * 2. Staff must have active working hours on that day_of_week
 * 3. Effective window = intersection of business hours and staff hours
 * 4. Exclude staff break window
 * 5. Exclude blocked slots (staff-specific or business-wide)
 * 6. Exclude existing booking assignments for this staff
 * 7. Only return slots where the full service duration fits
 */
export function getAvailableSlots(params: AvailabilityParams): AvailabilityResult {
  const {
    date,
    staffId,
    serviceDuration,
    businessHours,
    staffWorkingHours,
    blockedSlots,
    existingAssignments,
    slotInterval = DEFAULT_SLOT_INTERVAL,
    timezone,
  } = params

  const dateStr = formatDate(date)
  const dayOfWeek = date.getUTCDay()

  // 1. Check business hours for this day
  const bizHours = businessHours.find(
    (bh) => bh.day_of_week === dayOfWeek && bh.is_open
  )
  if (!bizHours) {
    return { date: dateStr, staffId, slots: [], isAvailable: false }
  }

  // 2. Check staff working hours for this day
  const staffHours = staffWorkingHours.find(
    (swh) => swh.day_of_week === dayOfWeek && swh.is_active
  )
  if (!staffHours) {
    return { date: dateStr, staffId, slots: [], isAvailable: false }
  }

  // 3. Effective window = intersection
  const effectiveStart = maxTime(bizHours.open_time, staffHours.start_time)
  const effectiveEnd = minTime(bizHours.close_time, staffHours.end_time)

  const startMinutes = timeToMinutes(effectiveStart)
  const endMinutes = timeToMinutes(effectiveEnd)

  if (startMinutes >= endMinutes) {
    return { date: dateStr, staffId, slots: [], isAvailable: false }
  }

  // 4. Build blocked intervals (break + blocked_slots + existing assignments)
  const blockedIntervals: Array<{ start: number; end: number }> = []

  // Staff break
  if (staffHours.break_start && staffHours.break_end) {
    blockedIntervals.push({
      start: timeToMinutes(staffHours.break_start),
      end: timeToMinutes(staffHours.break_end),
    })
  }

  // Blocked slots for this staff or business-wide (staff_id = null)
  const relevantBlocked = blockedSlots.filter(
    (bs) => bs.staff_id === staffId || bs.staff_id === null
  )

  for (const blocked of relevantBlocked) {
    const blockedStart = new Date(blocked.starts_at)
    const blockedEnd = new Date(blocked.ends_at)
    const dateStart = new Date(dateStr + 'T00:00:00Z')
    const dateEnd = new Date(dateStr + 'T23:59:59Z')

    // Check if blocked slot overlaps with our date
    if (blockedStart <= dateEnd && blockedEnd >= dateStart) {
      if (blocked.is_all_day) {
        // All day block — no slots available
        return { date: dateStr, staffId, slots: [], isAvailable: false }
      }
      // Convert to minutes of day
      const bStartMin = blockedStart <= dateStart
        ? 0
        : blockedStart.getUTCHours() * 60 + blockedStart.getUTCMinutes()
      const bEndMin = blockedEnd >= dateEnd
        ? 24 * 60
        : blockedEnd.getUTCHours() * 60 + blockedEnd.getUTCMinutes()

      blockedIntervals.push({ start: bStartMin, end: bEndMin })
    }
  }

  // Existing booking assignments for this staff on this date
  const relevantAssignments = existingAssignments.filter(
    (a) => a.staff_id === staffId
  )

  for (const assignment of relevantAssignments) {
    const aStart = new Date(assignment.starts_at)
    const aEnd = new Date(assignment.ends_at)
    const dateStart = new Date(dateStr + 'T00:00:00Z')
    const dateEnd = new Date(dateStr + 'T23:59:59Z')

    if (aStart <= dateEnd && aEnd >= dateStart) {
      const aStartMin = aStart.getUTCHours() * 60 + aStart.getUTCMinutes()
      const aEndMin = aEnd.getUTCHours() * 60 + aEnd.getUTCMinutes()
      blockedIntervals.push({ start: aStartMin, end: aEndMin })
    }
  }

  // 5. Generate slots
  const slots: TimeSlot[] = []

  for (let current = startMinutes; current + serviceDuration <= endMinutes; current += slotInterval) {
    const slotStart = current
    const slotEnd = current + serviceDuration

    const overlapsBlocked = blockedIntervals.some(
      (bi) => slotStart < bi.end && slotEnd > bi.start
    )

    if (!overlapsBlocked) {
      slots.push({
        start: minutesToTime(slotStart),
        end: minutesToTime(slotEnd),
      })
    }
  }

  return {
    date: dateStr,
    staffId,
    slots,
    isAvailable: slots.length > 0,
  }
}

// ── Helpers ──

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function maxTime(a: string, b: string): string {
  return timeToMinutes(a) >= timeToMinutes(b) ? a : b
}

function minTime(a: string, b: string): string {
  return timeToMinutes(a) <= timeToMinutes(b) ? a : b
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
