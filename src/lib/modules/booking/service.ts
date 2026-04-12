import type { Service, StaffProfile, BookingAssignment } from '@/types/database'

// ── Types for pure functions (no DB dependency) ──

interface BookingLineItem {
  service: Service
  staff: StaffProfile
  customDuration: number | null
}

interface BuildBookingInput {
  businessId: string
  date: string       // YYYY-MM-DD
  startTime: string  // HH:mm
  timezone: string
  items: BookingLineItem[]
}

interface BookingLine {
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  priceCents: number
  durationMinutes: number
  startsAt: string
  endsAt: string
  sortOrder: number
}

interface BookingAggregate {
  totalPriceCents: number
  totalDurationMinutes: number
  currency: string
  startsAt: string
  endsAt: string
  lines: BookingLine[]
}

interface ValidateDoubleBookingInput {
  staffId: string
  startsAt: string
  endsAt: string
  existingAssignments: BookingAssignment[]
}

interface DoubleBookingResult {
  isValid: boolean
  conflictingAssignmentId?: string
}

/**
 * Build a booking aggregate from a list of service+staff selections.
 * Services are scheduled sequentially starting from startTime.
 * Pure function — no database dependency.
 */
export function buildBookingAggregate(input: BuildBookingInput): BookingAggregate {
  const { date, startTime, items } = input

  const lines: BookingLine[] = []
  let currentTime = parseDateTime(date, startTime)
  let totalPriceCents = 0
  let totalDurationMinutes = 0
  let currency = 'EUR'

  for (let i = 0; i < items.length; i++) {
    const { service, staff, customDuration } = items[i]
    const duration = customDuration ?? service.duration_minutes
    const endTime = new Date(currentTime.getTime() + duration * 60 * 1000)

    lines.push({
      serviceId: service.id,
      serviceName: service.name,
      staffId: staff.id,
      staffName: staff.name,
      priceCents: service.price_cents,
      durationMinutes: duration,
      startsAt: currentTime.toISOString(),
      endsAt: endTime.toISOString(),
      sortOrder: i,
    })

    totalPriceCents += service.price_cents
    totalDurationMinutes += duration
    currency = service.currency
    currentTime = endTime
  }

  return {
    totalPriceCents,
    totalDurationMinutes,
    currency,
    startsAt: lines[0].startsAt,
    endsAt: lines[lines.length - 1].endsAt,
    lines,
  }
}

/**
 * Validate that a proposed assignment does not overlap with existing ones
 * for the same staff member. Adjacent bookings (end === start) are allowed.
 */
export function validateNoDoubleBooking(input: ValidateDoubleBookingInput): DoubleBookingResult {
  const { staffId, startsAt, endsAt, existingAssignments } = input
  const newStart = new Date(startsAt).getTime()
  const newEnd = new Date(endsAt).getTime()

  for (const assignment of existingAssignments) {
    if (assignment.staff_id !== staffId) continue

    const existingStart = new Date(assignment.starts_at).getTime()
    const existingEnd = new Date(assignment.ends_at).getTime()

    // Overlap: newStart < existingEnd AND newEnd > existingStart
    if (newStart < existingEnd && newEnd > existingStart) {
      return { isValid: false, conflictingAssignmentId: assignment.id }
    }
  }

  return { isValid: true }
}

// ── Helpers ──

function parseDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`)
}
