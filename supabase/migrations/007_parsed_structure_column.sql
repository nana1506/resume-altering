-- ============================================================================
-- CV Tailor - Migration 007: Structured Parsed CV Representation
-- Adds parsed_structure column to cv_documents and entry_index to suggested_changes
-- ============================================================================

ALTER TABLE public.cv_documents
  ADD COLUMN IF NOT EXISTS parsed_structure jsonb;

ALTER TABLE public.suggested_changes
  ADD COLUMN IF NOT EXISTS entry_index integer DEFAULT -1;
