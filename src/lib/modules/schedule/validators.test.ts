import { describe, it, expect } from 'vitest'
import { getAvailabilitySchema, blockedSlotSchema, businessHoursUpdateSchema } from './validators'

describe('getAvailabilitySchema', () => {
  it('validates correct input', () => {
    const result = getAvailabilitySchema.safeParse({
      date: '2025-06-02',
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('allows optional staffId', () => {
    const result = getAvailabilitySchema.safeParse({
      date: '2025-06-02',
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
      staffId: '550e8400-e29b-41d4-a716-446655440001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid date', () => {
    const result = getAvailabilitySchema.safeParse({
      date: '02-06-2025',
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid serviceId', () => {
    const result = getAvailabilitySchema.safeParse({
      date: '2025-06-02',
      serviceId: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('blockedSlotSchema', () => {
  it('validates correct input', () => {
    const result = blockedSlotSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      staffId: '550e8400-e29b-41d4-a716-446655440001',
      startsAt: '2025-06-02T10:00:00Z',
      endsAt: '2025-06-02T11:00:00Z',
      reason: 'Lunch break',
      isAllDay: false,
    })
    expect(result.success).toBe(true)
  })

  it('allows null staffId (business-wide block)', () => {
    const result = blockedSlotSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      staffId: null,
      startsAt: '2025-06-02T10:00:00Z',
      endsAt: '2025-06-02T11:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('defaults isAllDay to false', () => {
    const result = blockedSlotSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      startsAt: '2025-06-02T10:00:00Z',
      endsAt: '2025-06-02T11:00:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isAllDay).toBe(false)
    }
  })
})

describe('businessHoursUpdateSchema', () => {
  it('validates correct input', () => {
    const result = businessHoursUpdateSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      hours: [
        { dayOfWeek: 1, openTime: '09:00', closeTime: '19:00', isOpen: true },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects day_of_week out of range', () => {
    const result = businessHoursUpdateSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      hours: [
        { dayOfWeek: 7, openTime: '09:00', closeTime: '19:00', isOpen: true },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty hours array', () => {
    const result = businessHoursUpdateSchema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      hours: [],
    })
    expect(result.success).toBe(false)
  })
})
