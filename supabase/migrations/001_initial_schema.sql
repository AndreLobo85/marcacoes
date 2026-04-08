-- ============================================================
-- Marcações Platform — Initial Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════════════════════════════

CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'enterprise');

-- ════════════════════════════════════════════════════════════
-- BUSINESSES
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  address text,
  phone text,
  email text,
  logo_url text,
  timezone text NOT NULL DEFAULT 'Europe/Lisbon',
  settings jsonb DEFAULT '{}',
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_businesses_slug ON public.businesses (slug);
CREATE INDEX idx_businesses_owner ON public.businesses (owner_id);

-- ════════════════════════════════════════════════════════════
-- PROFESSIONALS
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  avatar_url text,
  color text NOT NULL DEFAULT '#3b82f6',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_professionals_business ON public.professionals (business_id);

-- ════════════════════════════════════════════════════════════
-- SERVICES
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  color text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_business ON public.services (business_id);

-- ════════════════════════════════════════════════════════════
-- PROFESSIONAL ↔ SERVICE (N:M)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.professional_services (
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  custom_duration_minutes integer,
  PRIMARY KEY (professional_id, service_id)
);

-- ════════════════════════════════════════════════════════════
-- WORKING HOURS
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.working_hours (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_working_hours_professional ON public.working_hours (professional_id, day_of_week);

-- ════════════════════════════════════════════════════════════
-- BREAKS
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.breaks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text,
  CONSTRAINT valid_break_range CHECK (start_time < end_time)
);

CREATE INDEX idx_breaks_professional ON public.breaks (professional_id, day_of_week);

-- ════════════════════════════════════════════════════════════
-- TIME OFF
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.time_off (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

CREATE INDEX idx_time_off_professional ON public.time_off (professional_id, start_date, end_date);

-- ════════════════════════════════════════════════════════════
-- CUSTOMERS
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_business ON public.customers (business_id);
CREATE INDEX idx_customers_email ON public.customers (business_id, email);

-- ════════════════════════════════════════════════════════════
-- BOOKINGS
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  notes text,
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT valid_booking_time CHECK (start_time < end_time)
);

CREATE INDEX idx_bookings_professional_time ON public.bookings (professional_id, start_time, end_time) WHERE status != 'cancelled';
CREATE INDEX idx_bookings_business_date ON public.bookings (business_id, start_time);
CREATE INDEX idx_bookings_customer ON public.bookings (customer_id);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Helper: get business IDs the current user owns or works at
CREATE OR REPLACE FUNCTION public.user_business_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  UNION
  SELECT business_id FROM public.professionals WHERE user_id = auth.uid()
$$;

-- ── Businesses ──

CREATE POLICY "Public can read businesses by slug"
  ON public.businesses FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert businesses"
  ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own businesses"
  ON public.businesses FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete own businesses"
  ON public.businesses FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── Professionals ──

CREATE POLICY "Anyone can read professionals (public pages)"
  ON public.professionals FOR SELECT
  USING (true);

CREATE POLICY "Business owners can manage professionals"
  ON public.professionals FOR ALL TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.user_business_ids()));

-- ── Services ──

CREATE POLICY "Anyone can read services (public pages)"
  ON public.services FOR SELECT
  USING (true);

CREATE POLICY "Business owners can manage services"
  ON public.services FOR ALL TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.user_business_ids()));

-- ── Professional Services ──

CREATE POLICY "Anyone can read professional_services"
  ON public.professional_services FOR SELECT
  USING (true);

CREATE POLICY "Business members can manage professional_services"
  ON public.professional_services FOR ALL TO authenticated
  USING (
    professional_id IN (
      SELECT id FROM public.professionals WHERE business_id IN (SELECT public.user_business_ids())
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM public.professionals WHERE business_id IN (SELECT public.user_business_ids())
    )
  );

-- ── Working Hours ──

CREATE POLICY "Anyone can read working_hours (availability)"
  ON public.working_hours FOR SELECT
  USING (true);

CREATE POLICY "Business members can manage working_hours"
  ON public.working_hours FOR ALL TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.user_business_ids()));

-- ── Breaks ──

CREATE POLICY "Anyone can read breaks (availability)"
  ON public.breaks FOR SELECT
  USING (true);

CREATE POLICY "Business members can manage breaks"
  ON public.breaks FOR ALL TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.user_business_ids()));

-- ── Time Off ──

CREATE POLICY "Anyone can read time_off (availability)"
  ON public.time_off FOR SELECT
  USING (true);

CREATE POLICY "Business members can manage time_off"
  ON public.time_off FOR ALL TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.user_business_ids()));

-- ── Customers ──

CREATE POLICY "Business members can read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()));

CREATE POLICY "Anyone can insert customers (public booking)"
  ON public.customers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Business members can manage customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.user_business_ids()));

-- ── Bookings ──

CREATE POLICY "Business members can read bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()));

CREATE POLICY "Anyone can insert bookings (public booking)"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Business members can update bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()))
  WITH CHECK (business_id IN (SELECT public.user_business_ids()));

CREATE POLICY "Business members can delete bookings"
  ON public.bookings FOR DELETE TO authenticated
  USING (business_id IN (SELECT public.user_business_ids()));

-- ════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
