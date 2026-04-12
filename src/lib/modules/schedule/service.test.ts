import { describe, it, expect } from 'vitest'
import { getAvailableSlots } from './service'
import type { BusinessHours, StaffWorkingHours, BlockedSlot, BookingAssignment } from '@/types/database'

// ── Test Helpers ──

function makeBusinessHours(overrides: Partial<BusinessHours> = {}): BusinessHours {
  return {
    id: 'bh-1',
    business_id: 'biz-1',
    day_of_week: 1, // Monday
    open_time: '09:00',
    close_time: '19:00',
    is_open: true,
    ...overrides,
  }
}

function makeStaffWorkingHours(overrides: Partial<StaffWorkingHours> = {}): StaffWorkingHours {
  return {
    id: 'swh-1',
    staff_id: 'staff-1',
    business_id: 'biz-1',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '18:00',
    break_start: null,
    break_end: null,
    is_active: true,
    ...overrides,
  }
}

function makeBlockedSlot(overrides: Partial<BlockedSlot> = {}): BlockedSlot {
  return {
    id: 'bs-1',
    business_id: 'biz-1',
    staff_id: 'staff-1',
    starts_at: '2025-06-02T10:00:00Z',
    ends_at: '2025-06-02T11:00:00Z',
    reason: 'blocked',
    is_all_day: false,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeAssignment(overrides: Partial<BookingAssignment> = {}): BookingAssignment {
  return {
    id: 'ba-1',
    booking_service_id: 'bs-1',
    staff_id: 'staff-1',
    starts_at: '2025-06-02T10:00:00+00:00',
    ends_at: '2025-06-02T10:30:00+00:00',
    ...overrides,
  }
}

// Monday 2025-06-02
const MONDAY = new Date('2025-06-02T00:00:00Z')
const SUNDAY = new Date('2025-06-01T00:00:00Z')
const TUESDAY = new Date('2025-06-03T00:00:00Z')

describe('getAvailableSlots', () => {
  // ── Basic availability ──

  it('returns slots within business+staff hours intersection', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '12:00' })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, start_time: '10:00', end_time: '12:00' })],
      blockedSlots: [],
      existingAssignments: [],
      slotInterval: 30,
      timezone: 'UTC',
    })

    expect(result.slots.length).toBeGreaterThan(0)
    // First slot should be 10:00 (staff starts at 10, not business 09)
    expect(result.slots[0].start).toBe('10:00')
    // Last slot should allow 30min service to finish by 12:00
    expect(result.slots[result.slots.length - 1].start).toBe('11:30')
    expect(result.isAvailable).toBe(true)
  })

  it('returns empty when business is closed on that day', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, is_open: false })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1 })],
      blockedSlots: [],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([])
    expect(result.isAvailable).toBe(false)
  })

  it('returns empty when no business hours for that day', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 3 })], // Wednesday, not Monday
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1 })],
      blockedSlots: [],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([])
    expect(result.isAvailable).toBe(false)
  })

  it('returns empty when staff has no working hours that day', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1 })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 3 })], // Wednesday
      blockedSlots: [],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([])
    expect(result.isAvailable).toBe(false)
  })

  it('returns empty when staff working hours are inactive', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1 })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, is_active: false })],
      blockedSlots: [],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([])
    expect(result.isAvailable).toBe(false)
  })

  // ── Break handling ──

  it('excludes slots that overlap with staff break', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '14:00' })],
      staffWorkingHours: [makeStaffWorkingHours({
        day_of_week: 1,
        start_time: '09:00',
        end_time: '14:00',
        break_start: '12:00',
        break_end: '13:00',
      })],
      blockedSlots: [],
      existingAssignments: [],
      slotInterval: 30,
      timezone: 'UTC',
    })

    const slotStarts = result.slots.map(s => s.start)
    // 12:00 and 12:30 should be excluded (overlap with 12:00-13:00 break)
    expect(slotStarts).not.toContain('12:00')
    expect(slotStarts).not.toContain('12:30')
    // 11:30 is fine (ends at 12:00 which is the break start — no overlap)
    expect(slotStarts).toContain('11:30')
    // 13:00 is fine
    expect(slotStarts).toContain('13:00')
  })

  // ── Blocked slots ──

  it('excludes slots that overlap with a blocked slot', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '12:00' })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, start_time: '09:00', end_time: '12:00' })],
      blockedSlots: [makeBlockedSlot({
        staff_id: 'staff-1',
        starts_at: '2025-06-02T10:00:00Z',
        ends_at: '2025-06-02T11:00:00Z',
      })],
      existingAssignments: [],
      slotInterval: 30,
      timezone: 'UTC',
    })

    const slotStarts = result.slots.map(s => s.start)
    expect(slotStarts).not.toContain('10:00')
    expect(slotStarts).not.toContain('10:30')
    expect(slotStarts).toContain('09:00')
    expect(slotStarts).toContain('11:00')
  })

  it('excludes ALL slots when all-day blocked slot for staff', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1 })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1 })],
      blockedSlots: [makeBlockedSlot({
        staff_id: 'staff-1',
        starts_at: '2025-06-02T00:00:00Z',
        ends_at: '2025-06-03T00:00:00Z',
        is_all_day: true,
      })],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([])
    expect(result.isAvailable).toBe(false)
  })

  it('excludes ALL slots when business-wide blocked slot (staff_id=null)', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1 })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1 })],
      blockedSlots: [makeBlockedSlot({
        staff_id: null,
        starts_at: '2025-06-02T00:00:00Z',
        ends_at: '2025-06-03T00:00:00Z',
        is_all_day: true,
      })],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([])
    expect(result.isAvailable).toBe(false)
  })

  // ── Double-booking prevention ──

  it('excludes slots that overlap with existing booking assignments', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '12:00' })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, start_time: '09:00', end_time: '12:00' })],
      blockedSlots: [],
      existingAssignments: [makeAssignment({
        staff_id: 'staff-1',
        starts_at: '2025-06-02T10:00:00Z',
        ends_at: '2025-06-02T10:45:00Z',
      })],
      slotInterval: 15,
      timezone: 'UTC',
    })

    const slotStarts = result.slots.map(s => s.start)
    // 10:00, 10:15, 10:30 are blocked (overlap with 10:00-10:45)
    // 09:45 would end at 10:15 which overlaps — also blocked
    expect(slotStarts).not.toContain('10:00')
    expect(slotStarts).not.toContain('10:15')
    expect(slotStarts).toContain('09:00')
    expect(slotStarts).toContain('10:45')
  })

  it('does not exclude slots for assignments of other staff', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '12:00' })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, start_time: '09:00', end_time: '12:00' })],
      blockedSlots: [],
      existingAssignments: [makeAssignment({
        staff_id: 'staff-2', // different staff
        starts_at: '2025-06-02T10:00:00Z',
        ends_at: '2025-06-02T10:30:00Z',
      })],
      slotInterval: 30,
      timezone: 'UTC',
    })

    const slotStarts = result.slots.map(s => s.start)
    expect(slotStarts).toContain('10:00')
  })

  // ── Slot interval ──

  it('respects custom slot interval', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '10:00' })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, start_time: '09:00', end_time: '10:00' })],
      blockedSlots: [],
      existingAssignments: [],
      slotInterval: 15,
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([
      { start: '09:00', end: '09:30' },
      { start: '09:15', end: '09:45' },
      { start: '09:30', end: '10:00' },
    ])
  })

  // ── Service duration edge cases ──

  it('returns empty when service duration exceeds available window', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 120, // 2 hours
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '10:00' })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, start_time: '09:00', end_time: '10:00' })],
      blockedSlots: [],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.slots).toEqual([])
  })

  // ── Date formatting ──

  it('returns the correct date string in result', () => {
    const result = getAvailableSlots({
      date: MONDAY,
      businessId: 'biz-1',
      staffId: 'staff-1',
      serviceDuration: 30,
      businessHours: [makeBusinessHours({ day_of_week: 1, open_time: '09:00', close_time: '10:00' })],
      staffWorkingHours: [makeStaffWorkingHours({ day_of_week: 1, start_time: '09:00', end_time: '10:00' })],
      blockedSlots: [],
      existingAssignments: [],
      timezone: 'UTC',
    })

    expect(result.date).toBe('2025-06-02')
    expect(result.staffId).toBe('staff-1')
  })
})
