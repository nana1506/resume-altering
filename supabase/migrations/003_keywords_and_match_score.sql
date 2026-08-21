-- =========================================================
-- CV Tailor - Migration 003: Keyword Analysis & ATS Match Score
-- =========================================================

-- Alter job_applications table to store match score, summary and keywords analysis
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS match_score integer,
  ADD COLUMN IF NOT EXISTS match_label text,
  ADD COLUMN IF NOT EXISTS match_summary text,
  ADD COLUMN IF NOT EXISTS keywords_analysis jsonb;
