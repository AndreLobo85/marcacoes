import type { BookingStatus } from '@/types/database'

export interface BookingServiceInput {
  serviceId: string
  staffId: string
}

export interface CreateBookingInput {
  businessId: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  services: BookingServiceInput[]
  date: string            // YYYY-MM-DD
  startTime: string       // HH:mm (for the first service)
  notes?: string
  timezone: string
}

export interface CreateBookingResult {
  bookingId: string
  status: BookingStatus
  totalPriceCents: number
  totalDurationMinutes: number
  currency: string
  startsAt: string
  endsAt: string
  services: Array<{
    serviceName: string
    staffName: string
    startsAt: string
    endsAt: string
    priceCents: number
  }>
}

export interface CancelBookingInput {
  bookingId: string
  businessId: string
  reason?: string
}
