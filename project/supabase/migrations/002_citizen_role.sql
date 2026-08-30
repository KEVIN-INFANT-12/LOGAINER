-- Smart Logistics & Disaster Response
-- Migration 002: Citizen Role Support
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ============================================================
-- 1. EXTEND profiles.role TO INCLUDE 'citizen'
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('driver', 'officer', 'citizen'));

-- ============================================================
-- 2. CITIZEN SUBMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.citizen_submissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_code TEXT UNIQUE NOT NULL,
  citizen_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description     TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  location_name   TEXT,
  incident_type   TEXT,
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'under_review', 'verified', 'resolved')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.citizen_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Citizens see own submissions" ON public.citizen_submissions
  FOR SELECT USING (citizen_id = auth.uid());

CREATE POLICY "Citizens create own submissions" ON public.citizen_submissions
  FOR INSERT WITH CHECK (citizen_id = auth.uid());

CREATE POLICY "Officers see all citizen submissions" ON public.citizen_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('officer')
    )
  );

-- ============================================================
-- 3. CITIZEN SUBMISSION MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.citizen_submission_media (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id   UUID NOT NULL REFERENCES public.citizen_submissions(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  file_name       TEXT,
  file_size       INTEGER,
  uploaded_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.citizen_submission_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Citizens see own submission media" ON public.citizen_submission_media
  FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "Citizens upload own media" ON public.citizen_submission_media
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Officers see citizen submission media" ON public.citizen_submission_media
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- ============================================================
-- 4. SECURE EXISTING TABLES FROM CITIZENS
-- ============================================================

-- Drop conflicting ALL-user policies on trips if any, then restrict
DROP POLICY IF EXISTS "Citizens blocked from trips" ON public.trips;
CREATE POLICY "Citizens blocked from trips" ON public.trips
  FOR SELECT USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'citizen'
    )
  );

DROP POLICY IF EXISTS "Citizens blocked from driver locations" ON public.driver_locations;
CREATE POLICY "Citizens blocked from driver locations" ON public.driver_locations
  FOR SELECT USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'citizen'
    )
  );

DROP POLICY IF EXISTS "Citizens blocked from vehicles" ON public.vehicles;
CREATE POLICY "Citizens blocked from vehicles" ON public.vehicles
  FOR SELECT USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'citizen'
    )
  );

-- ============================================================
-- 5. UPDATE AUTO-PROFILE TRIGGER FOR CITIZEN ROLE
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'citizen'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_citizen_submissions_citizen
  ON public.citizen_submissions(citizen_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_citizen_submission_media_submission
  ON public.citizen_submission_media(submission_id);

-- ============================================================
-- 7. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.citizen_submissions;

-- ============================================================
-- 8. STORAGE BUCKET
-- ============================================================
-- Create in Supabase Dashboard > Storage:
--   Name: "citizen-media" | Public: true | Max size: 50MB
--   Allowed MIME: image/*, video/*
-- Storage policies for citizen-media bucket:
--   INSERT: (auth.role() = 'authenticated')
--   SELECT: true

-- ============================================================
-- 9. DEMO CREDENTIALS NOTE
-- ============================================================
-- Citizen:  citizen@smartlogistics.app / Citizen@123
