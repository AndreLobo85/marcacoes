import { z } from 'zod'

export const getAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
})

export const businessHoursUpdateSchema = z.object({
  businessId: z.string().uuid(),
  hours: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(/^\d{2}:\d{2}$/),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/),
    isOpen: z.boolean(),
  })).min(1).max(7),
})

export const blockedSlotSchema = z.object({
  businessId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
  isAllDay: z.boolean().optional().default(false),
})
