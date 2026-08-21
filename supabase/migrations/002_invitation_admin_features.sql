-- =========================================================
-- CV Tailor - Migration 002: Invitation & Admin Features,
-- Terms & Conditions Agreement, and Company Tracking
-- =========================================================

-- 1. Alter profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS terms_agreed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz;

-- Update trigger function to extract name from user metadata if provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    COALESCE(new.raw_user_meta_data->>'status', 'active')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    name = COALESCE(excluded.name, public.profiles.name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Alter job_applications table
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS company_name text;

-- 3. Create access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  goals text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on access_requests
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Access Requests Policies
DROP POLICY IF EXISTS "Public can submit access request" ON public.access_requests;
CREATE POLICY "Public can submit access request"
  ON public.access_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view access requests" ON public.access_requests;
CREATE POLICY "Admins can view access requests"
  ON public.access_requests FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update access requests" ON public.access_requests;
CREATE POLICY "Admins can update access requests"
  ON public.access_requests FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete access requests" ON public.access_requests;
CREATE POLICY "Admins can delete access requests"
  ON public.access_requests FOR DELETE
  USING (public.is_admin());

-- Profiles Policies Updates for Admin
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin() OR auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin() OR auth.uid() = id);

-- Job Applications Policies Updates for Admin
DROP POLICY IF EXISTS "Admins can view all job applications" ON public.job_applications;
CREATE POLICY "Admins can view all job applications"
  ON public.job_applications FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

-- =========================================================
-- DML QUERIES: Seed / Promote Initial Admin User
-- =========================================================

-- Promote isnan.rizqikurniawan@gmail.com to Admin
UPDATE public.profiles
SET 
  role = 'admin',
  status = 'active',
  terms_agreed = true,
  terms_agreed_at = now()
WHERE email = 'isnan.rizqikurniawan@gmail.com';
