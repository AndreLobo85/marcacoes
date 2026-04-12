import { describe, it, expect } from 'vitest'
import { createBookingSchema, cancelBookingSchema } from './validators'

describe('createBookingSchema', () => {
  const validInput = {
    businessId: '550e8400-e29b-41d4-a716-446655440000',
    customerName: 'Carlos Silva',
    customerEmail: 'carlos@example.com',
    customerPhone: '+351912345678',
    services: [
      { serviceId: '550e8400-e29b-41d4-a716-446655440001', staffId: '550e8400-e29b-41d4-a716-446655440002' },
    ],
    date: '2025-06-02',
    startTime: '10:00',
    timezone: 'Europe/Lisbon',
  }

  it('validates correct input', () => {
    const result = createBookingSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects empty customer name', () => {
    const result = createBookingSchema.safeParse({ ...validInput, customerName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = createBookingSchema.safeParse({ ...validInput, customerEmail: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('allows null email', () => {
    const result = createBookingSchema.safeParse({ ...validInput, customerEmail: null })
    expect(result.success).toBe(true)
  })

  it('rejects empty services array', () => {
    const result = createBookingSchema.safeParse({ ...validInput, services: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 services', () => {
    const services = Array.from({ length: 11 }, (_, i) => ({
      serviceId: `550e8400-e29b-41d4-a716-44665544000${i}`,
      staffId: '550e8400-e29b-41d4-a716-446655440002',
    }))
    const result = createBookingSchema.safeParse({ ...validInput, services })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = createBookingSchema.safeParse({ ...validInput, date: '02/06/2025' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format', () => {
    const result = createBookingSchema.safeParse({ ...validInput, startTime: '10:00:00' })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid serviceId', () => {
    const result = createBookingSchema.safeParse({
      ...validInput,
      services: [{ serviceId: 'not-a-uuid', staffId: '550e8400-e29b-41d4-a716-446655440002' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('cancelBookingSchema', () => {
  it('validates correct input', () => {
    const result = cancelBookingSchema.safeParse({
      bookingId: '550e8400-e29b-41d4-a716-446655440000',
      businessId: '550e8400-e29b-41d4-a716-446655440001',
      reason: 'Customer requested',
    })
    expect(result.success).toBe(true)
  })

  it('allows missing reason', () => {
    const result = cancelBookingSchema.safeParse({
      bookingId: '550e8400-e29b-41d4-a716-446655440000',
      businessId: '550e8400-e29b-41d4-a716-446655440001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid bookingId', () => {
    const result = cancelBookingSchema.safeParse({
      bookingId: 'invalid',
      businessId: '550e8400-e29b-41d4-a716-446655440001',
    })
    expect(result.success).toBe(false)
  })
})
