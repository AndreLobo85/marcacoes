import { describe, it, expect } from 'vitest'
import { buildNotificationPayload, signWebhookPayload, verifyWebhookSignature } from './service'

describe('buildNotificationPayload', () => {
  it('builds correct payload from booking data', () => {
    const payload = buildNotificationPayload({
      business: {
        id: 'biz-1',
        name: 'BarberShop Pro',
        locale: 'pt',
        timezone: 'Europe/Lisbon',
        currency: 'EUR',
      },
      booking: {
        id: 'book-1',
        startsAt: '2025-06-02T10:00:00Z',
        endsAt: '2025-06-02T10:50:00Z',
        totalPriceCents: 2500,
        currency: 'EUR',
      },
      customer: {
        name: 'Carlos',
        email: 'carlos@example.com',
        phone: '+351912345678',
      },
      services: [
        { serviceName: 'Corte', staffName: 'João', startsAt: '2025-06-02T10:00:00Z', endsAt: '2025-06-02T10:30:00Z', priceCents: 1500 },
        { serviceName: 'Barba', staffName: 'João', startsAt: '2025-06-02T10:30:00Z', endsAt: '2025-06-02T10:50:00Z', priceCents: 1000 },
      ],
    })

    expect(payload.businessId).toBe('biz-1')
    expect(payload.businessName).toBe('BarberShop Pro')
    expect(payload.bookingId).toBe('book-1')
    expect(payload.customerName).toBe('Carlos')
    expect(payload.services).toHaveLength(2)
    expect(payload.totalPriceCents).toBe(2500)
    expect(payload.locale).toBe('pt')
    expect(payload.timezone).toBe('Europe/Lisbon')
  })
})

describe('webhook signing', () => {
  const secret = 'test-webhook-secret-key-123'
  const payload = JSON.stringify({ event: 'booking_created', id: '123' })

  it('produces a hex signature string', () => {
    const signature = signWebhookPayload(payload, secret)
    expect(signature).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verifies correct signature', () => {
    const signature = signWebhookPayload(payload, secret)
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true)
  })

  it('rejects wrong signature', () => {
    expect(verifyWebhookSignature(payload, 'wrong-signature', secret)).toBe(false)
  })

  it('rejects tampered payload', () => {
    const signature = signWebhookPayload(payload, secret)
    const tampered = JSON.stringify({ event: 'booking_cancelled', id: '123' })
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false)
  })
})
