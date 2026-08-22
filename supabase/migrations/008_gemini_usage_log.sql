-- Migration: 008_gemini_usage_log.sql
-- Description: Create gemini_usage_log table to track Gemini API calls, token counts, models, and enforce daily quotas.

create table if not exists gemini_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  application_id uuid references job_applications(id) on delete set null,
  input_tokens integer,
  output_tokens integer,
  model_used text,
  created_at timestamptz not null default now()
);

create index if not exists gemini_usage_log_user_id_created_at_idx on gemini_usage_log(user_id, created_at);

alter table gemini_usage_log enable row level security;

-- Users can only view their own usage logs
create policy "gemini_usage_log_select_own" on gemini_usage_log
  for select using (auth.uid() = user_id);
