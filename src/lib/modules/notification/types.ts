export type NotificationEventType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'reminder_24h'
  | 'reminder_1h'

export interface NotificationPayload {
  businessId: string
  businessName: string
  bookingId: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  services: Array<{
    serviceName: string
    staffName: string
    startsAt: string
    endsAt: string
    priceCents: number
  }>
  totalPriceCents: number
  currency: string
  startsAt: string
  endsAt: string
  locale: string
  timezone: string
}

export interface FireWebhookInput {
  eventId: string
  eventType: NotificationEventType
  payload: NotificationPayload
  webhookUrl: string
  webhookSecret: string
}
