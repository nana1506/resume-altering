-- Migration 009: Add default_cv_document_id to profiles for reusable profile CV
alter table profiles 
add column if not exists default_cv_document_id uuid references cv_documents(id) on delete set null;
