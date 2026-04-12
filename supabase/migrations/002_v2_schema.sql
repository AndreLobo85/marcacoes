-- ============================================================
-- Marcacoes Platform — V2 Schema Migration
-- From flat booking model to aggregate booking model
-- Adds: RBAC, business_hours, blocked_slots, payments, notifications
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- NEW ENUMS
-- ════════════════════════════════════════════════════════════

CREATE TYPE member_role AS ENUM ('owner', 'manager', 'staff', 'receptionist');
CREATE TYPE payment_mode AS ENUM ('none', 'deposit_fixed', 'deposit_percent', 'full_prepay');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'failed', 'bounced');

-- ════════════════════════════════════════════════════════════
-- 1. ALTER businesses — add i18n columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'PT',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

-- ════════════════════════════════════════════════════════════
-- 2. business_members (RBAC)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'staff',
  invited_email text,
  invited_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE INDEX idx_business_members_business ON public.business_members (business_id);
CREATE INDEX idx_business_members_user ON public.business_members (user_id);

-- ════════════════════════════════════════════════════════════
-- 3. Rename professionals -> staff_profiles
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.professionals RENAME TO staff_profiles;
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS bio text;

-- Rename indexes
ALTER INDEX idx_professionals_business RENAME TO idx_staff_profiles_business;

-- ════════════════════════════════════════════════════════════
-- 4. Rename professional_services -> staff_services
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.professional_services RENAME TO staff_services;
ALTER TABLE public.staff_services RENAME COLUMN professional_id TO staff_id;
ALTER TABLE public.staff_services ADD COLUMN IF NOT EXISTS custom_price_cents integer;

-- ════════════════════════════════════════════════════════════
-- 5. Add category to services
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category text;

-- ════════════════════════════════════════════════════════════
-- 6. business_hours (separate from staff hours)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time NOT NULL,
  close_time time NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  UNIQUE (business_id, day_of_week),
  CONSTRAINT valid_business_hours CHECK (open_time < close_time)
);

CREATE INDEX idx_business_hours_business ON public.business_hours (business_id);

-- ════════════════════════════════════════════════════════════
-- 7. Rename working_hours -> staff_working_hours + add breaks inline
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.working_hours RENAME TO staff_working_hours;
ALTER TABLE public.staff_working_hours RENAME COLUMN professional_id TO staff_id;
ALTER TABLE public.staff_working_hours
  ADD COLUMN IF NOT EXISTS break_start time,
  ADD COLUMN IF NOT EXISTS break_end time;

ALTER INDEX idx_working_hours_professional RENAME TO idx_staff_working_hours_staff;

-- ════════════════════════════════════════════════════════════
-- 8. blocked_slots (replaces time_off + breaks for ad-hoc blocks)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.blocked_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  is_all_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_blocked_slot CHECK (starts_at < ends_at)
);

CREATE INDEX idx_blocked_slots_business ON public.blocked_slots (business_id);
CREATE INDEX idx_blocked_slots_staff ON public.blocked_slots (staff_id, starts_at, ends_at);

-- Migrate existing time_off data into blocked_slots
INSERT INTO public.blocked_slots (business_id, staff_id, starts_at, ends_at, reason, is_all_day)
SELECT
  business_id,
  professional_id,
  start_date::timestamptz,
  (end_date + interval '1 day')::timestamptz,
  reason,
  true
FROM public.time_off;

-- ════════════════════════════════════════════════════════════
-- 9. Booking aggregate model
-- ════════════════════════════════════════════════════════════

-- 9a. Drop old booking constraints that reference flat model
-- We keep the old bookings table but transform it

-- First, add new columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS total_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_duration_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

-- Copy start_time/end_time to starts_at/ends_at
UPDATE public.bookings SET starts_at = start_time, ends_at = end_time WHERE starts_at IS NULL;

-- 9b. booking_services (line items)
CREATE TABLE public.booking_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_booking_services_booking ON public.booking_services (booking_id);

-- 9c. booking_assignments (staff + time per line)
CREATE TABLE public.booking_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_service_id uuid NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  UNIQUE (booking_service_id),
  CONSTRAINT valid_assignment_time CHECK (starts_at < ends_at)
);

CREATE INDEX idx_booking_assignments_staff_time
  ON public.booking_assignments (staff_id, starts_at, ends_at);

-- Migrate existing flat bookings into the new aggregate model
INSERT INTO public.booking_services (booking_id, service_id, service_name, price_cents, duration_minutes, sort_order)
SELECT
  b.id,
  b.service_id,
  s.name,
  s.price_cents,
  s.duration_minutes,
  0
FROM public.bookings b
JOIN public.services s ON s.id = b.service_id;

INSERT INTO public.booking_assignments (booking_service_id, staff_id, starts_at, ends_at)
SELECT
  bs.id,
  b.professional_id,
  b.start_time,
  b.end_time
FROM public.bookings b
JOIN public.booking_services bs ON bs.booking_id = b.id;

-- Update totals
UPDATE public.bookings b SET
  total_price_cents = COALESCE((SELECT SUM(price_cents) FROM public.booking_services WHERE booking_id = b.id), 0),
  total_duration_minutes = COALESCE((SELECT SUM(duration_minutes) FROM public.booking_services WHERE booking_id = b.id), 0);

-- ════════════════════════════════════════════════════════════
-- 10. payment_settings (per business)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  payment_mode payment_mode NOT NULL DEFAULT 'none',
  deposit_amount_cents integer,
  deposit_percent integer CHECK (deposit_percent IS NULL OR (deposit_percent >= 1 AND deposit_percent <= 100)),
  stripe_account_id text,
  stripe_onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

-- ════════════════════════════════════════════════════════════
-- 11. payments
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  refund_amount_cents integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking ON public.payments (booking_id);
CREATE INDEX idx_payments_business ON public.payments (business_id);
CREATE INDEX idx_payments_stripe ON public.payments (stripe_payment_intent_id);

-- ════════════════════════════════════════════════════════════
-- 12. notification_events
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status notification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_notification_events_business ON public.notification_events (business_id);
CREATE INDEX idx_notification_events_status ON public.notification_events (status) WHERE status = 'pending';

-- ════════════════════════════════════════════════════════════
-- 13. notification_deliveries
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL,
  recipient text NOT NULL,
  status delivery_status NOT NULL DEFAULT 'pending',
  external_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz
);

CREATE INDEX idx_notification_deliveries_event ON public.notification_deliveries (event_id);

-- ════════════════════════════════════════════════════════════
-- 14. UPDATED_AT TRIGGERS for new tables
-- ════════════════════════════════════════════════════════════

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ════════════════════════════════════════════════════════════
-- 15. RLS on new tables
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════
-- 16. Replace helper function with RBAC-aware version
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.user_business_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT business_id FROM public.business_members
  WHERE user_id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_member_role(p_business_id uuid)
RETURNS member_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.business_members
  WHERE business_id = p_business_id
    AND user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- Helper: check if user has one of the given roles in a business
CREATE OR REPLACE FUNCTION public.has_role(p_business_id uuid, p_roles member_role[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND is_active = true
      AND role = ANY(p_roles)
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 17. RLS POLICIES for new tables
-- ════════════════════════════════════════════════════════════

-- ── business_members ──

CREATE POLICY "Members can see their own business members"
  ON public.business_members FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()));

CREATE POLICY "Owners can manage business members"
  ON public.business_members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(business_id, ARRAY['owner']::member_role[]));

CREATE POLICY "Owners can update business members"
  ON public.business_members FOR UPDATE TO authenticated
  USING (public.has_role(business_id, ARRAY['owner']::member_role[]))
  WITH CHECK (public.has_role(business_id, ARRAY['owner']::member_role[]));

CREATE POLICY "Owners can delete business members"
  ON public.business_members FOR DELETE TO authenticated
  USING (public.has_role(business_id, ARRAY['owner']::member_role[]));

-- ── business_hours ──

CREATE POLICY "Anyone can read business_hours"
  ON public.business_hours FOR SELECT
  USING (true);

CREATE POLICY "Owners/managers can manage business_hours"
  ON public.business_hours FOR ALL TO authenticated
  USING (public.has_role(business_id, ARRAY['owner', 'manager']::member_role[]))
  WITH CHECK (public.has_role(business_id, ARRAY['owner', 'manager']::member_role[]));

-- ── blocked_slots ──

CREATE POLICY "Anyone can read blocked_slots (availability)"
  ON public.blocked_slots FOR SELECT
  USING (true);

CREATE POLICY "Owners/managers can manage blocked_slots"
  ON public.blocked_slots FOR ALL TO authenticated
  USING (public.has_role(business_id, ARRAY['owner', 'manager']::member_role[]))
  WITH CHECK (public.has_role(business_id, ARRAY['owner', 'manager']::member_role[]));

-- ── booking_services ──

CREATE POLICY "Members can read booking_services"
  ON public.booking_services FOR SELECT TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM public.bookings WHERE business_id IN (SELECT public.user_business_ids())
    )
  );

CREATE POLICY "Public can insert booking_services (via booking)"
  ON public.booking_services FOR INSERT
  WITH CHECK (true);

-- ── booking_assignments ──

CREATE POLICY "Members can read booking_assignments"
  ON public.booking_assignments FOR SELECT TO authenticated
  USING (
    booking_service_id IN (
      SELECT bs.id FROM public.booking_services bs
      JOIN public.bookings b ON b.id = bs.booking_id
      WHERE b.business_id IN (SELECT public.user_business_ids())
    )
  );

CREATE POLICY "Public can insert booking_assignments (via booking)"
  ON public.booking_assignments FOR INSERT
  WITH CHECK (true);

-- ── payment_settings ──

CREATE POLICY "Owners/managers can read payment_settings"
  ON public.payment_settings FOR SELECT TO authenticated
  USING (public.has_role(business_id, ARRAY['owner', 'manager']::member_role[]));

CREATE POLICY "Owners can manage payment_settings"
  ON public.payment_settings FOR ALL TO authenticated
  USING (public.has_role(business_id, ARRAY['owner']::member_role[]))
  WITH CHECK (public.has_role(business_id, ARRAY['owner']::member_role[]));

-- ── payments ──

CREATE POLICY "Owners/managers can read payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(business_id, ARRAY['owner', 'manager']::member_role[]));

-- payments INSERT/UPDATE only via service_role (Stripe webhooks)

-- ── notification_events ──

CREATE POLICY "Owners/managers can read notification_events"
  ON public.notification_events FOR SELECT TO authenticated
  USING (public.has_role(business_id, ARRAY['owner', 'manager']::member_role[]));

-- notification_events INSERT only via service_role

-- ── notification_deliveries ──

CREATE POLICY "Owners/managers can read notification_deliveries"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.notification_events
      WHERE business_id IN (SELECT public.user_business_ids())
    )
  );

-- ════════════════════════════════════════════════════════════
-- 18. Seed owner into business_members for existing businesses
-- ════════════════════════════════════════════════════════════

INSERT INTO public.business_members (business_id, user_id, role, joined_at)
SELECT id, owner_id, 'owner', created_at
FROM public.businesses
ON CONFLICT (business_id, user_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 19. Create default business_hours for existing businesses
-- ════════════════════════════════════════════════════════════

-- Monday-Saturday 09:00-19:00, Sunday closed
INSERT INTO public.business_hours (business_id, day_of_week, open_time, close_time, is_open)
SELECT b.id, d.dow, '09:00'::time, '19:00'::time, d.dow != 0
FROM public.businesses b
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS d(dow)
ON CONFLICT (business_id, day_of_week) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 20. Create default payment_settings for existing businesses
-- ════════════════════════════════════════════════════════════

INSERT INTO public.payment_settings (business_id, is_enabled, payment_mode)
SELECT id, false, 'none'
FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;
