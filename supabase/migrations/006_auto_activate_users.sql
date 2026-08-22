-- ============================================================================
-- CV Tailor - Migration 006: Auto-Activate Invited Users
-- Automatically transitions profile status from 'invited' to 'active'
-- when the user accepts Terms & Conditions or creates applications.
-- ============================================================================

-- 1. One-time data fix: Update any existing users who have agreed to terms
-- or have active CV documents / applications to 'active' status
UPDATE public.profiles
SET status = 'active'
WHERE status = 'invited'
  AND (
    terms_agreed = true
    OR id IN (SELECT DISTINCT user_id FROM public.job_applications)
    OR id IN (SELECT DISTINCT user_id FROM public.cv_documents)
  );

-- 2. Trigger function to auto-activate profile when terms are agreed
CREATE OR REPLACE FUNCTION public.auto_activate_profile_on_terms()
RETURNS trigger AS $$
BEGIN
  IF NEW.terms_agreed = true AND (OLD.status = 'invited' OR NEW.status = 'invited') THEN
    NEW.status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_activate_profile ON public.profiles;
CREATE TRIGGER trg_auto_activate_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_activate_profile_on_terms();
