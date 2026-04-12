import { createHmac, timingSafeEqual } from 'crypto'
import type { NotificationPayload } from './types'

// ── Payload Builder ──

interface BuildPayloadInput {
  business: {
    id: string
    name: string
    locale: string
    timezone: string
    currency: string
  }
  booking: {
    id: string
    startsAt: string
    endsAt: string
    totalPriceCents: number
    currency: string
  }
  customer: {
    name: string
    email: string | null
    phone: string | null
  }
  services: Array<{
    serviceName: string
    staffName: string
    startsAt: string
    endsAt: string
    priceCents: number
  }>
}

/**
 * Build a structured notification payload from booking data.
 * This payload is sent to n8n via webhook.
 */
export function buildNotificationPayload(input: BuildPayloadInput): NotificationPayload {
  return {
    businessId: input.business.id,
    businessName: input.business.name,
    bookingId: input.booking.id,
    customerName: input.customer.name,
    customerEmail: input.customer.email,
    customerPhone: input.customer.phone,
    services: input.services,
    totalPriceCents: input.booking.totalPriceCents,
    currency: input.booking.currency,
    startsAt: input.booking.startsAt,
    endsAt: input.booking.endsAt,
    locale: input.business.locale,
    timezone: input.business.timezone,
  }
}

// ── Webhook Signing ──

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Returns a hex-encoded signature string.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify that a webhook signature matches the expected payload.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhookPayload(payload, secret)

  if (expected.length !== signature.length) return false

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}
