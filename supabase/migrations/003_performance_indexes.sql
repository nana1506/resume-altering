-- =========================================================
-- CV Tailor - Migration 003: Performance Optimization Indexes
-- =========================================================

-- 1. Index job_applications by user_id and created_at (for Dashboard queries and RLS checks)
CREATE INDEX IF NOT EXISTS idx_job_applications_user_created 
  ON public.job_applications (user_id, created_at DESC);

-- 2. Index suggested_changes by application_id and checked status (for checklist & generation queries)
CREATE INDEX IF NOT EXISTS idx_suggested_changes_app_id 
  ON public.suggested_changes (application_id);

CREATE INDEX IF NOT EXISTS idx_suggested_changes_app_checked 
  ON public.suggested_changes (application_id, checked);

-- 3. Index generated_cvs by application_id (for fast joined result lookups)
CREATE INDEX IF NOT EXISTS idx_generated_cvs_app_id 
  ON public.generated_cvs (application_id, created_at DESC);

-- 4. Index cv_documents by user_id
CREATE INDEX IF NOT EXISTS idx_cv_documents_user_id 
  ON public.cv_documents (user_id, created_at DESC);

-- 5. Index access_requests by status and created_at (for Admin filtering and sorting)
CREATE INDEX IF NOT EXISTS idx_access_requests_status_created 
  ON public.access_requests (status, created_at DESC);

-- 6. Index profiles by role and status (for Admin stats and lookup)
CREATE INDEX IF NOT EXISTS idx_profiles_role_status 
  ON public.profiles (role, status);
