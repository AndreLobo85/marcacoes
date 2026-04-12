import type { BusinessHours, StaffWorkingHours, BlockedSlot, BookingAssignment } from '@/types/database'

export interface TimeSlot {
  start: string // HH:mm
  end: string   // HH:mm
}

export interface AvailabilityParams {
  date: Date
  businessId: string
  staffId: string
  serviceDuration: number // minutes
  businessHours: BusinessHours[]
  staffWorkingHours: StaffWorkingHours[]
  blockedSlots: BlockedSlot[]
  existingAssignments: BookingAssignment[]
  slotInterval?: number // minutes, default 15
  timezone: string
}

export interface AvailabilityResult {
  date: string          // YYYY-MM-DD
  staffId: string
  slots: TimeSlot[]
  isAvailable: boolean
}
