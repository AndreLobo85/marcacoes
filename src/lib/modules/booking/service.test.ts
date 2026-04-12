import { describe, it, expect } from 'vitest'
import {
  buildBookingAggregate,
  validateNoDoubleBooking,
} from './service'
import type { Service, StaffProfile, BookingAssignment } from '@/types/database'

// ── Helpers ──

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    business_id: 'biz-1',
    name: 'Corte de Cabelo',
    description: null,
    duration_minutes: 30,
    price_cents: 1500,
    currency: 'EUR',
    category: null,
    color: null,
    is_active: true,
    sort_order: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeStaff(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: 'staff-1',
    business_id: 'biz-1',
    user_id: null,
    name: 'João',
    email: null,
    phone: null,
    avatar_url: null,
    color: '#3b82f6',
    bio: null,
    is_active: true,
    sort_order: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildBookingAggregate', () => {
  it('builds aggregate with single service', () => {
    const result = buildBookingAggregate({
      businessId: 'biz-1',
      date: '2025-06-02',
      startTime: '10:00',
      timezone: 'UTC',
      items: [
        { service: makeService(), staff: makeStaff(), customDuration: null },
      ],
    })

    expect(result.totalPriceCents).toBe(1500)
    expect(result.totalDurationMinutes).toBe(30)
    expect(result.currency).toBe('EUR')
    expect(result.lines.length).toBe(1)
    expect(result.lines[0].serviceName).toBe('Corte de Cabelo')
    expect(result.lines[0].staffId).toBe('staff-1')
    expect(result.lines[0].startsAt).toBe('2025-06-02T10:00:00.000Z')
    expect(result.lines[0].endsAt).toBe('2025-06-02T10:30:00.000Z')
  })

  it('builds aggregate with multiple services sequentially', () => {
    const result = buildBookingAggregate({
      businessId: 'biz-1',
      date: '2025-06-02',
      startTime: '10:00',
      timezone: 'UTC',
      items: [
        { service: makeService({ id: 'svc-1', name: 'Corte', duration_minutes: 30, price_cents: 1500 }), staff: makeStaff(), customDuration: null },
        { service: makeService({ id: 'svc-2', name: 'Barba', duration_minutes: 20, price_cents: 1000 }), staff: makeStaff(), customDuration: null },
      ],
    })

    expect(result.totalPriceCents).toBe(2500)
    expect(result.totalDurationMinutes).toBe(50)
    expect(result.lines.length).toBe(2)

    // First service starts at 10:00, ends at 10:30
    expect(result.lines[0].startsAt).toBe('2025-06-02T10:00:00.000Z')
    expect(result.lines[0].endsAt).toBe('2025-06-02T10:30:00.000Z')

    // Second service starts right after: 10:30, ends at 10:50
    expect(result.lines[1].startsAt).toBe('2025-06-02T10:30:00.000Z')
    expect(result.lines[1].endsAt).toBe('2025-06-02T10:50:00.000Z')
  })

  it('uses custom duration when provided via staff_services', () => {
    const result = buildBookingAggregate({
      businessId: 'biz-1',
      date: '2025-06-02',
      startTime: '10:00',
      timezone: 'UTC',
      items: [
        { service: makeService({ duration_minutes: 30 }), staff: makeStaff(), customDuration: 45 },
      ],
    })

    expect(result.totalDurationMinutes).toBe(45)
    expect(result.lines[0].endsAt).toBe('2025-06-02T10:45:00.000Z')
  })

  it('computes booking-level starts_at and ends_at', () => {
    const result = buildBookingAggregate({
      businessId: 'biz-1',
      date: '2025-06-02',
      startTime: '14:00',
      timezone: 'UTC',
      items: [
        { service: makeService({ duration_minutes: 30 }), staff: makeStaff(), customDuration: null },
        { service: makeService({ duration_minutes: 20 }), staff: makeStaff(), customDuration: null },
      ],
    })

    expect(result.startsAt).toBe('2025-06-02T14:00:00.000Z')
    expect(result.endsAt).toBe('2025-06-02T14:50:00.000Z')
  })
})

describe('validateNoDoubleBooking', () => {
  it('returns true when no overlaps', () => {
    const result = validateNoDoubleBooking({
      staffId: 'staff-1',
      startsAt: '2025-06-02T10:00:00Z',
      endsAt: '2025-06-02T10:30:00Z',
      existingAssignments: [],
    })
    expect(result.isValid).toBe(true)
  })

  it('returns false when overlaps with existing assignment', () => {
    const existing: BookingAssignment = {
      id: 'ba-1',
      booking_service_id: 'bs-1',
      staff_id: 'staff-1',
      starts_at: '2025-06-02T10:00:00Z',
      ends_at: '2025-06-02T10:30:00Z',
    }
    const result = validateNoDoubleBooking({
      staffId: 'staff-1',
      startsAt: '2025-06-02T10:15:00Z',
      endsAt: '2025-06-02T10:45:00Z',
      existingAssignments: [existing],
    })
    expect(result.isValid).toBe(false)
    expect(result.conflictingAssignmentId).toBe('ba-1')
  })

  it('allows adjacent bookings (end = start)', () => {
    const existing: BookingAssignment = {
      id: 'ba-1',
      booking_service_id: 'bs-1',
      staff_id: 'staff-1',
      starts_at: '2025-06-02T10:00:00Z',
      ends_at: '2025-06-02T10:30:00Z',
    }
    const result = validateNoDoubleBooking({
      staffId: 'staff-1',
      startsAt: '2025-06-02T10:30:00Z',
      endsAt: '2025-06-02T11:00:00Z',
      existingAssignments: [existing],
    })
    expect(result.isValid).toBe(true)
  })

  it('ignores assignments for other staff', () => {
    const existing: BookingAssignment = {
      id: 'ba-1',
      booking_service_id: 'bs-1',
      staff_id: 'staff-2',
      starts_at: '2025-06-02T10:00:00Z',
      ends_at: '2025-06-02T10:30:00Z',
    }
    const result = validateNoDoubleBooking({
      staffId: 'staff-1',
      startsAt: '2025-06-02T10:00:00Z',
      endsAt: '2025-06-02T10:30:00Z',
      existingAssignments: [existing],
    })
    expect(result.isValid).toBe(true)
  })
})
