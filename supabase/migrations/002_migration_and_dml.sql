-- ============================================================================
-- CV TAILOR - COMPLETE DDL & DML MIGRATION (Version 2.0)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: DDL (Schema Updates & New Tables)
-- ----------------------------------------------------------------------------

-- 1.1 Alter profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS terms_agreed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz;

-- 1.2 Alter job_applications table
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS company_name text;

-- 1.3 Create access_requests table for invitation system
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  goals text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamptz DEFAULT now()
);

-- 1.4 Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- 1.5 Admin Helper Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR email = 'isnan.rizqikurniawan@gmail.com')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.6 Update User Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status, terms_agreed)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    CASE 
      WHEN new.email = 'isnan.rizqikurniawan@gmail.com' THEN 'admin'
      ELSE COALESCE(new.raw_user_meta_data->>'role', 'user')
    END,
    COALESCE(new.raw_user_meta_data->>'status', 'active'),
    CASE 
      WHEN new.email = 'isnan.rizqikurniawan@gmail.com' THEN true
      ELSE false
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    name = COALESCE(public.profiles.name, excluded.name),
    role = CASE 
      WHEN excluded.email = 'isnan.rizqikurniawan@gmail.com' THEN 'admin'
      ELSE public.profiles.role
    END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 1.7 Access Requests Policies
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

-- 1.8 Profiles Policies (User self-access + Admin view/update all)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins and users can view profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin() OR auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins and users can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin() OR auth.uid() = id);

-- 1.9 Job Applications Policies (Add Delete policy + Admin view)
DROP POLICY IF EXISTS "Users can view own job_applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can view all job applications" ON public.job_applications;
CREATE POLICY "Admins and users can view job applications"
  ON public.job_applications FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own job_applications" ON public.job_applications;
CREATE POLICY "Users can delete own job_applications"
  ON public.job_applications FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ----------------------------------------------------------------------------
-- PART 2: DML (Data Synchronization, Seeding & Admin Promotion)
-- ----------------------------------------------------------------------------

-- 2.1 Backfill default values for any existing profiles
UPDATE public.profiles
SET 
  name = COALESCE(name, split_part(email, '@', 1)),
  role = COALESCE(role, 'user'),
  status = COALESCE(status, 'active'),
  terms_agreed = COALESCE(terms_agreed, false)
WHERE name IS NULL OR role IS NULL OR status IS NULL OR terms_agreed IS NULL;

-- 2.2 PROMOTE ADMIN: isnan.rizqikurniawan@gmail.com
-- (Updates if profile already exists, or creates profile row from auth.users)
INSERT INTO public.profiles (id, email, name, role, status, terms_agreed, terms_agreed_at)
SELECT 
  id,
  email,
  'Isnan Rizqi Kurniawan',
  'admin',
  'active',
  true,
  now()
FROM auth.users
WHERE email = 'isnan.rizqikurniawan@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  status = 'active',
  terms_agreed = true,
  terms_agreed_at = now();

-- Ensure existing profile is set to admin
UPDATE public.profiles
SET 
  role = 'admin',
  status = 'active',
  terms_agreed = true,
  terms_agreed_at = now()
WHERE email = 'isnan.rizqikurniawan@gmail.com';

-- ----------------------------------------------------------------------------
-- Verification Query (Run to confirm current state)
-- ----------------------------------------------------------------------------
SELECT id, email, name, role, status, terms_agreed FROM public.profiles;
