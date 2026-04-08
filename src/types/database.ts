export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise'

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          description: string | null
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          timezone: string
          settings: Json | null
          subscription_plan: SubscriptionPlan
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          slug: string
          description?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          timezone?: string
          settings?: Json | null
          subscription_plan?: SubscriptionPlan
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          slug?: string
          description?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          timezone?: string
          settings?: Json | null
          subscription_plan?: SubscriptionPlan
          updated_at?: string
        }
      }
      professionals: {
        Row: {
          id: string
          business_id: string
          user_id: string | null
          name: string
          email: string | null
          phone: string | null
          avatar_url: string | null
          color: string
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          color?: string
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          color?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string | null
          duration_minutes: number
          price_cents: number
          currency: string
          color: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          description?: string | null
          duration_minutes: number
          price_cents: number
          currency?: string
          color?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          description?: string | null
          duration_minutes?: number
          price_cents?: number
          currency?: string
          color?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
      }
      professional_services: {
        Row: {
          professional_id: string
          service_id: string
          custom_duration_minutes: number | null
        }
        Insert: {
          professional_id: string
          service_id: string
          custom_duration_minutes?: number | null
        }
        Update: {
          professional_id?: string
          service_id?: string
          custom_duration_minutes?: number | null
        }
      }
      working_hours: {
        Row: {
          id: string
          professional_id: string
          business_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active: boolean
        }
        Insert: {
          id?: string
          professional_id: string
          business_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active?: boolean
        }
        Update: {
          id?: string
          professional_id?: string
          business_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          is_active?: boolean
        }
      }
      breaks: {
        Row: {
          id: string
          professional_id: string
          business_id: string
          day_of_week: number
          start_time: string
          end_time: string
          label: string | null
        }
        Insert: {
          id?: string
          professional_id: string
          business_id: string
          day_of_week: number
          start_time: string
          end_time: string
          label?: string | null
        }
        Update: {
          id?: string
          professional_id?: string
          business_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          label?: string | null
        }
      }
      time_off: {
        Row: {
          id: string
          professional_id: string
          business_id: string
          start_date: string
          end_date: string
          reason: string | null
        }
        Insert: {
          id?: string
          professional_id: string
          business_id: string
          start_date: string
          end_date: string
          reason?: string | null
        }
        Update: {
          id?: string
          professional_id?: string
          business_id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
        }
      }
      bookings: {
        Row: {
          id: string
          business_id: string
          professional_id: string
          service_id: string
          customer_id: string
          start_time: string
          end_time: string
          status: BookingStatus
          notes: string | null
          google_event_id: string | null
          created_at: string
          updated_at: string
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          professional_id: string
          service_id: string
          customer_id: string
          start_time: string
          end_time: string
          status?: BookingStatus
          notes?: string | null
          google_event_id?: string | null
          created_at?: string
          updated_at?: string
          cancelled_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          professional_id?: string
          service_id?: string
          customer_id?: string
          start_time?: string
          end_time?: string
          status?: BookingStatus
          notes?: string | null
          google_event_id?: string | null
          updated_at?: string
          cancelled_at?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          business_id: string
          user_id: string | null
          name: string
          email: string | null
          phone: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          user_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      booking_status: BookingStatus
      subscription_plan: SubscriptionPlan
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Convenience aliases
export type Business = Tables<'businesses'>
export type Professional = Tables<'professionals'>
export type Service = Tables<'services'>
export type WorkingHours = Tables<'working_hours'>
export type Break = Tables<'breaks'>
export type TimeOff = Tables<'time_off'>
export type Booking = Tables<'bookings'>
export type Customer = Tables<'customers'>
