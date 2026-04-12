export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Enums ──

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise'
export type MemberRole = 'owner' | 'manager' | 'staff' | 'receptionist'
export type PaymentMode = 'none' | 'deposit_fixed' | 'deposit_percent' | 'full_prepay'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type NotificationStatus = 'pending' | 'sent' | 'failed'
export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'bounced'

// ── Table Row Types ──

export interface Business {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  cover_image_url: string | null
  country: string
  timezone: string
  locale: string
  currency: string
  theme: string
  footer_notes: string | null
  social_facebook: string | null
  social_instagram: string | null
  social_website: string | null
  booking_page_online: boolean
  booking_page_settings: Json | null
  settings: Json | null
  subscription_plan: SubscriptionPlan
  created_at: string
  updated_at: string
}

export interface BusinessMember {
  id: string
  business_id: string
  user_id: string
  role: MemberRole
  invited_email: string | null
  invited_at: string | null
  joined_at: string | null
  is_active: boolean
  created_at: string
}

export interface StaffProfile {
  id: string
  business_id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  color: string
  bio: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  business_id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  currency: string
  category: string | null
  color: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface StaffService {
  staff_id: string
  service_id: string
  custom_duration_minutes: number | null
  custom_price_cents: number | null
}

export interface BusinessHours {
  id: string
  business_id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_open: boolean
}

export interface StaffWorkingHours {
  id: string
  staff_id: string
  business_id: string
  day_of_week: number
  start_time: string
  end_time: string
  break_start: string | null
  break_end: string | null
  is_active: boolean
}

export interface BlockedSlot {
  id: string
  business_id: string
  staff_id: string | null
  starts_at: string
  ends_at: string
  reason: string | null
  is_all_day: boolean
  created_at: string
}

export interface Booking {
  id: string
  business_id: string
  customer_id: string
  status: BookingStatus
  total_price_cents: number
  total_duration_minutes: number
  currency: string
  notes: string | null
  internal_notes: string | null
  starts_at: string
  ends_at: string
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface BookingService {
  id: string
  booking_id: string
  service_id: string
  service_name: string
  price_cents: number
  duration_minutes: number
  sort_order: number
}

export interface BookingAssignment {
  id: string
  booking_service_id: string
  staff_id: string
  starts_at: string
  ends_at: string
}

export interface Customer {
  id: string
  business_id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  birthday_date: string | null
  created_at: string
  updated_at: string
}

export interface PaymentSettings {
  id: string
  business_id: string
  is_enabled: boolean
  payment_mode: PaymentMode
  deposit_amount_cents: number | null
  deposit_percent: number | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  booking_id: string
  business_id: string
  amount_cents: number
  currency: string
  status: PaymentStatus
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  refund_amount_cents: number
  metadata: Json | null
  created_at: string
  updated_at: string
}

export interface NotificationEvent {
  id: string
  business_id: string
  booking_id: string | null
  event_type: string
  payload: Json
  status: NotificationStatus
  created_at: string
  processed_at: string | null
}

export interface NotificationDelivery {
  id: string
  event_id: string
  channel: string
  recipient: string
  status: DeliveryStatus
  external_id: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
}

// ── Database Interface (for Supabase client typing) ──

export interface Database {
  public: {
    Tables: {
      businesses: { Row: Business; Insert: Partial<Business> & Pick<Business, 'owner_id' | 'name' | 'slug'>; Update: Partial<Business>; Relationships: [] }
      business_members: { Row: BusinessMember; Insert: Partial<BusinessMember> & Pick<BusinessMember, 'business_id' | 'user_id' | 'role'>; Update: Partial<BusinessMember>; Relationships: [] }
      staff_profiles: { Row: StaffProfile; Insert: Partial<StaffProfile> & Pick<StaffProfile, 'business_id' | 'name'>; Update: Partial<StaffProfile>; Relationships: [] }
      services: { Row: Service; Insert: Partial<Service> & Pick<Service, 'business_id' | 'name' | 'duration_minutes' | 'price_cents'>; Update: Partial<Service>; Relationships: [] }
      staff_services: { Row: StaffService; Insert: StaffService; Update: Partial<StaffService>; Relationships: [] }
      business_hours: { Row: BusinessHours; Insert: Partial<BusinessHours> & Pick<BusinessHours, 'business_id' | 'day_of_week' | 'open_time' | 'close_time'>; Update: Partial<BusinessHours>; Relationships: [] }
      staff_working_hours: { Row: StaffWorkingHours; Insert: Partial<StaffWorkingHours> & Pick<StaffWorkingHours, 'staff_id' | 'business_id' | 'day_of_week' | 'start_time' | 'end_time'>; Update: Partial<StaffWorkingHours>; Relationships: [] }
      blocked_slots: { Row: BlockedSlot; Insert: Partial<BlockedSlot> & Pick<BlockedSlot, 'business_id' | 'starts_at' | 'ends_at'>; Update: Partial<BlockedSlot>; Relationships: [] }
      customers: { Row: Customer; Insert: Partial<Customer> & Pick<Customer, 'business_id' | 'name'>; Update: Partial<Customer>; Relationships: [] }
      bookings: { Row: Booking; Insert: Partial<Booking> & Pick<Booking, 'business_id' | 'customer_id' | 'starts_at' | 'ends_at'>; Update: Partial<Booking>; Relationships: [] }
      booking_services: { Row: BookingService; Insert: Partial<BookingService> & Pick<BookingService, 'booking_id' | 'service_id' | 'service_name' | 'duration_minutes'>; Update: Partial<BookingService>; Relationships: [] }
      booking_assignments: { Row: BookingAssignment; Insert: Partial<BookingAssignment> & Pick<BookingAssignment, 'booking_service_id' | 'staff_id' | 'starts_at' | 'ends_at'>; Update: Partial<BookingAssignment>; Relationships: [] }
      payment_settings: { Row: PaymentSettings; Insert: Partial<PaymentSettings> & Pick<PaymentSettings, 'business_id'>; Update: Partial<PaymentSettings>; Relationships: [] }
      payments: { Row: Payment; Insert: Partial<Payment> & Pick<Payment, 'booking_id' | 'business_id' | 'amount_cents' | 'currency'>; Update: Partial<Payment>; Relationships: [] }
      notification_events: { Row: NotificationEvent; Insert: Partial<NotificationEvent> & Pick<NotificationEvent, 'business_id' | 'event_type' | 'payload'>; Update: Partial<NotificationEvent>; Relationships: [] }
      notification_deliveries: { Row: NotificationDelivery; Insert: Partial<NotificationDelivery> & Pick<NotificationDelivery, 'event_id' | 'channel' | 'recipient'>; Update: Partial<NotificationDelivery>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      booking_status: BookingStatus
      subscription_plan: SubscriptionPlan
      member_role: MemberRole
      payment_mode: PaymentMode
      payment_status: PaymentStatus
      notification_status: NotificationStatus
      delivery_status: DeliveryStatus
    }
  }
}

// Backwards-compatible aliases
export type Professional = StaffProfile
export type WorkingHours = StaffWorkingHours
export interface Break { id: string; professional_id: string; business_id: string; day_of_week: number; start_time: string; end_time: string; label: string | null }
