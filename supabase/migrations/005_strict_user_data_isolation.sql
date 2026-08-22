-- ============================================================================
-- CV Tailor - Migration 005: Strict User Data Isolation
-- Each user (including admins) can ONLY see, manage, and have rights on
-- their own CV documents, job applications, suggestions, and generated CVs.
-- ============================================================================

-- 1. Job Applications: Drop any admin view/delete bypass policies and enforce strict user ownership
DROP POLICY IF EXISTS "Admins and users can view job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Admins can view all job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can view own job_applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can delete own job_applications" ON public.job_applications;

CREATE POLICY "Users can view own job_applications"
  ON public.job_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own job_applications"
  ON public.job_applications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own job_applications"
  ON public.job_applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job_applications"
  ON public.job_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. CV Documents: Strictly own documents
DROP POLICY IF EXISTS "Users can view own cv_documents" ON public.cv_documents;
DROP POLICY IF EXISTS "Users can insert own cv_documents" ON public.cv_documents;
DROP POLICY IF EXISTS "Users can update own cv_documents" ON public.cv_documents;
DROP POLICY IF EXISTS "Users can delete own cv_documents" ON public.cv_documents;

CREATE POLICY "Users can view own cv_documents"
  ON public.cv_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cv_documents"
  ON public.cv_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cv_documents"
  ON public.cv_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cv_documents"
  ON public.cv_documents FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Suggested Changes: Strictly linked to own job application
DROP POLICY IF EXISTS "Users can view own suggested_changes" ON public.suggested_changes;
DROP POLICY IF EXISTS "Users can insert own suggested_changes" ON public.suggested_changes;
DROP POLICY IF EXISTS "Users can update own suggested_changes" ON public.suggested_changes;
DROP POLICY IF EXISTS "Users can delete own suggested_changes" ON public.suggested_changes;

CREATE POLICY "Users can view own suggested_changes"
  ON public.suggested_changes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.id = suggested_changes.application_id
      AND ja.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own suggested_changes"
  ON public.suggested_changes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.id = suggested_changes.application_id
      AND ja.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own suggested_changes"
  ON public.suggested_changes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.id = suggested_changes.application_id
      AND ja.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own suggested_changes"
  ON public.suggested_changes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.id = suggested_changes.application_id
      AND ja.user_id = auth.uid()
    )
  );

-- 4. Generated CVs: Strictly linked to own job application
DROP POLICY IF EXISTS "Users can view own generated_cvs" ON public.generated_cvs;
DROP POLICY IF EXISTS "Users can insert own generated_cvs" ON public.generated_cvs;
DROP POLICY IF EXISTS "Users can delete own generated_cvs" ON public.generated_cvs;

CREATE POLICY "Users can view own generated_cvs"
  ON public.generated_cvs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.id = generated_cvs.application_id
      AND ja.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own generated_cvs"
  ON public.generated_cvs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.id = generated_cvs.application_id
      AND ja.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own generated_cvs"
  ON public.generated_cvs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.id = generated_cvs.application_id
      AND ja.user_id = auth.uid()
    )
  );
