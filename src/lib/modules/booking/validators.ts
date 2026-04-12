import { z } from 'zod'

export const bookingServiceInputSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
})

export const createBookingSchema = z.object({
  businessId: z.string().uuid(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().nullable().optional(),
  customerPhone: z.string().max(30).nullable().optional(),
  services: z.array(bookingServiceInputSchema).min(1).max(10),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(1000).optional(),
  timezone: z.string().min(1),
})

export const cancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  businessId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})
