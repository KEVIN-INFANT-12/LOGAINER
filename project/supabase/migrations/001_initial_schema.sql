-- Smart Logistics & Disaster Response — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('driver', 'officer')),
  full_name       TEXT,
  phone           TEXT,
  email           TEXT,
  avatar_url      TEXT,
  language_code   TEXT DEFAULT 'en',
  dob             DATE,
  address         TEXT,
  emergency_contact TEXT,
  assigned_region TEXT,
  department      TEXT,
  designation     TEXT,
  employee_id     TEXT,
  bio             TEXT,
  rating          NUMERIC(3,1) DEFAULT 5.0,
  trip_count      INTEGER DEFAULT 0,
  report_count    INTEGER DEFAULT 0,
  on_time_pct     NUMERIC(5,2) DEFAULT 100.0,
  profile_completion INTEGER DEFAULT 60,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Officers can view driver profiles (for field operations)
CREATE POLICY "Officers can view driver profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'officer'
    )
  );

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type    TEXT,
  registration    TEXT,
  model           TEXT,
  capacity_tons   NUMERIC(6,2),
  weight_kg       INTEGER,
  fuel_type       TEXT CHECK (fuel_type IN ('Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid')),
  vehicle_photo_url TEXT,
  insurance_valid_till DATE,
  rc_valid_till   DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage own vehicles" ON public.vehicles
  FOR ALL USING (driver_id = auth.uid());

CREATE POLICY "Officers view vehicles" ON public.vehicles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- ============================================================
-- DRIVER LOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  is_live     BOOLEAN DEFAULT TRUE,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage own location" ON public.driver_locations
  FOR ALL USING (driver_id = auth.uid());

CREATE POLICY "Officers view driver locations" ON public.driver_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- Index for fast latest-location queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_time
  ON public.driver_locations(driver_id, timestamp DESC);

-- ============================================================
-- TRIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trips (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_code         TEXT UNIQUE NOT NULL,
  product           TEXT NOT NULL,
  quantity          TEXT NOT NULL,
  pickup_location   TEXT NOT NULL,
  drop_location     TEXT NOT NULL,
  pickup_lat        DOUBLE PRECISION,
  pickup_lng        DOUBLE PRECISION,
  drop_lat          DOUBLE PRECISION,
  drop_lng          DOUBLE PRECISION,
  distance_km       NUMERIC(8,2),
  duration_mins     INTEGER,
  capacity          TEXT,
  priority          TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'priority', 'urgent')),
  status            TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'accepted', 'going_to_pickup', 'arrived_at_pickup', 'package_loaded', 'in_transit', 'arrived_at_destination', 'delivered', 'cancelled')),
  driver_id         UUID REFERENCES public.profiles(id),
  instructions      TEXT,
  road_condition    TEXT,
  accepted_at       TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Drivers can see available trips + their own trips
CREATE POLICY "Drivers see available and own trips" ON public.trips
  FOR SELECT USING (
    status = 'available' OR driver_id = auth.uid()
  );

-- Drivers can accept (update) available trips
CREATE POLICY "Drivers accept trips" ON public.trips
  FOR UPDATE USING (
    (status = 'available' AND driver_id IS NULL) OR driver_id = auth.uid()
  );

-- Officers can see all trips
CREATE POLICY "Officers see all trips" ON public.trips
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- Insert sample trip data
INSERT INTO public.trips (trip_code, product, quantity, pickup_location, drop_location, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, duration_mins, capacity, priority, instructions, road_condition)
VALUES
  ('TR-2048', 'Electronics', '24 Packages', 'Guwahati Distribution Center', 'Shillong Warehouse', 26.1445, 91.7362, 25.5788, 91.8933, 142, 220, '2.5 Tons', 'priority', 'Handle with care. Fragile electronic equipment. Use padded loading.', 'Wet roads reported on NH-40 beyond Nongpoh. Drive cautiously.'),
  ('TR-2036', 'Medical Supplies', '45 Crates', 'Depot Alpha', 'Camp Zulu', 26.1058, 91.7086, 25.9011, 91.5234, 120, 170, '3.0 Tons', 'urgent', 'Temperature-sensitive cargo. Maintain cold chain. Priority dispatch.', 'Clear roads reported on corridor.'),
  ('TR-2029', 'Water Tanks', '12 Units', 'City Reservoir', 'Sector 4', 26.1723, 91.7540, 26.0856, 91.6912, 45, 80, '5.0 Tons', 'normal', 'Secure tanks properly. Check valves before departure.', 'Minor flooding on Sector 4 access road.'),
  ('TR-2015', 'Relief Kits', '200 Boxes', 'State Relief Warehouse', 'Tura Distribution Point', 26.1445, 91.7362, 25.5140, 90.2160, 310, 375, '4.0 Tons', 'priority', 'Relief materials for affected families. Coordinate with local admin on arrival.', 'Landslide debris reported near Tura pass. Verify before transit.')
ON CONFLICT (trip_code) DO NOTHING;

-- ============================================================
-- INCIDENTS / DISASTER REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incidents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_code     TEXT UNIQUE NOT NULL,
  type              TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  location_name     TEXT,
  description       TEXT,
  reporter_id       UUID REFERENCES public.profiles(id),
  people_affected   INTEGER DEFAULT 0,
  road_condition    TEXT DEFAULT 'Passable',
  vehicle_accessibility TEXT DEFAULT 'Accessible',
  recommended_action TEXT DEFAULT 'Monitor',
  status            TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'verified', 'response_active', 'resolved')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read incidents" ON public.incidents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Officers can create incidents" ON public.incidents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
    OR auth.uid() = reporter_id
  );

CREATE POLICY "Officers can update own incidents" ON public.incidents
  FOR UPDATE USING (reporter_id = auth.uid());

-- Sample incident data
INSERT INTO public.incidents (incident_code, type, severity, lat, lng, location_name, description, status)
VALUES
  ('INC-48291', 'Landslide', 'high', 25.8876, 91.9123, 'NH-40 near Nongpoh', 'Major landslide blocking NH-40. Multiple boulders on road. Alternative route via Jorabat bypass recommended.', 'under_review'),
  ('INC-48276', 'Flood', 'medium', 26.0234, 91.5678, 'Sector 4 Valley Pass', 'Minor flooding on Valley Pass access road. Water level rising. Reduce speed in low-lying areas.', 'verified'),
  ('INC-48194', 'Heavy Rain', 'low', 25.5788, 91.8933, 'Shillong Plateau', 'Heavy rain with reduced visibility. Road slippery. Exercise caution.', 'response_active')
ON CONFLICT (incident_code) DO NOTHING;

-- ============================================================
-- INCIDENT MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incident_media (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  file_name   TEXT,
  file_size   INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.incident_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view incident media" ON public.incident_media
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Officers upload incident media" ON public.incident_media
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- ============================================================
-- EMERGENCIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emergencies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT NOT NULL,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  location_name   TEXT,
  reported_by     UUID REFERENCES public.profiles(id),
  reporter_role   TEXT,
  reporter_name   TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.emergencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can report emergencies" ON public.emergencies
  FOR INSERT WITH CHECK (reported_by = auth.uid());

CREATE POLICY "All authenticated users can read emergencies" ON public.emergencies
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('trip', 'navigation', 'disaster', 'emergency', 'report', 'system')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'critical')),
  read        BOOLEAN DEFAULT FALSE,
  related_id  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- USER SECURITY PINS (Field Officers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_pins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash    TEXT NOT NULL,
  attempts    INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pin" ON public.user_pins
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

-- Function to handle new user creation (auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'driver'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to accept a trip (atomic, prevents double-accept)
CREATE OR REPLACE FUNCTION public.accept_trip(trip_id UUID, driver_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.trips
  SET status = 'accepted', driver_id = driver_uuid, accepted_at = NOW(), updated_at = NOW()
  WHERE id = trip_id AND status = 'available' AND driver_id IS NULL;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify officer PIN
CREATE OR REPLACE FUNCTION public.verify_officer_pin(p_user_id UUID, p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
  lock_time TIMESTAMPTZ;
  attempt_count INTEGER;
BEGIN
  SELECT pin_hash, locked_until, attempts INTO stored_hash, lock_time, attempt_count
  FROM public.user_pins
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF lock_time IS NOT NULL AND lock_time > NOW() THEN RETURN FALSE; END IF;
  
  IF stored_hash = crypt(p_pin, stored_hash) THEN
    UPDATE public.user_pins SET attempts = 0, locked_until = NULL WHERE user_id = p_user_id;
    RETURN TRUE;
  ELSE
    UPDATE public.user_pins SET attempts = attempts + 1,
      locked_until = CASE WHEN attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
    WHERE user_id = p_user_id;
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set officer PIN
CREATE OR REPLACE FUNCTION public.set_officer_pin(p_pin TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_pins (user_id, pin_hash)
  VALUES (auth.uid(), crypt(p_pin, gen_salt('bf')))
  ON CONFLICT (user_id) DO UPDATE SET
    pin_hash = crypt(p_pin, gen_salt('bf')),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REALTIME
-- ============================================================
-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergencies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;

-- ============================================================
-- STORAGE
-- ============================================================
-- Run in Supabase Dashboard > Storage > Create buckets:
-- 1. "avatars" (public: true)
-- 2. "incident-media" (public: true)
-- 3. "vehicle-photos" (public: true)

-- ============================================================
-- DEMO USERS NOTE
-- ============================================================
-- Create test users via Supabase Dashboard > Authentication > Users:
-- Driver:  driver@smartlogistics.app  / Driver@123
-- Officer: officer@smartlogistics.app / Officer@123
-- OR use the app's registration flow (sign up with role selection)
