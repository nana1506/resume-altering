-- ==========================================
-- CV Tailor - Initial Database Schema & RLS
-- ==========================================

-- 1. Profiles Table (mirrors auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

-- Trigger to automatically create a profile entry upon user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. CV Documents Table
create table if not exists public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  filename text not null,
  storage_path text not null,
  parsed_text text,
  created_at timestamptz default now()
);

-- 3. Job Applications Table
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  cv_document_id uuid references public.cv_documents(id) on delete cascade not null,
  job_title text not null,
  job_description_text text not null,
  created_at timestamptz default now()
);

-- 4. Suggested Changes Table
create table if not exists public.suggested_changes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.job_applications(id) on delete cascade not null,
  section text not null,
  original_text text,
  suggested_text text not null,
  reason text,
  checked boolean default true not null,
  final_text text,
  created_at timestamptz default now()
);

-- 5. Generated CVs Table
create table if not exists public.generated_cvs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.job_applications(id) on delete cascade not null,
  storage_path text not null,
  created_at timestamptz default now()
);

-- ==========================================
-- Enable Row Level Security (RLS) on all tables
-- ==========================================

alter table public.profiles enable row level security;
alter table public.cv_documents enable row level security;
alter table public.job_applications enable row level security;
alter table public.suggested_changes enable row level security;
alter table public.generated_cvs enable row level security;

-- Profiles Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- CV Documents Policies
create policy "Users can view own cv_documents"
  on public.cv_documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own cv_documents"
  on public.cv_documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cv_documents"
  on public.cv_documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own cv_documents"
  on public.cv_documents for delete
  using (auth.uid() = user_id);

-- Job Applications Policies
create policy "Users can view own job_applications"
  on public.job_applications for select
  using (auth.uid() = user_id);

create policy "Users can insert own job_applications"
  on public.job_applications for insert
  with check (auth.uid() = user_id);

create policy "Users can update own job_applications"
  on public.job_applications for update
  using (auth.uid() = user_id);

create policy "Users can delete own job_applications"
  on public.job_applications for delete
  using (auth.uid() = user_id);

-- Suggested Changes Policies (Join through job_applications)
create policy "Users can view own suggested_changes"
  on public.suggested_changes for select
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = suggested_changes.application_id
      and ja.user_id = auth.uid()
    )
  );

create policy "Users can insert own suggested_changes"
  on public.suggested_changes for insert
  with check (
    exists (
      select 1 from public.job_applications ja
      where ja.id = suggested_changes.application_id
      and ja.user_id = auth.uid()
    )
  );

create policy "Users can update own suggested_changes"
  on public.suggested_changes for update
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = suggested_changes.application_id
      and ja.user_id = auth.uid()
    )
  );

create policy "Users can delete own suggested_changes"
  on public.suggested_changes for delete
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = suggested_changes.application_id
      and ja.user_id = auth.uid()
    )
  );

-- Generated CVs Policies (Join through job_applications)
create policy "Users can view own generated_cvs"
  on public.generated_cvs for select
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = generated_cvs.application_id
      and ja.user_id = auth.uid()
    )
  );

create policy "Users can insert own generated_cvs"
  on public.generated_cvs for insert
  with check (
    exists (
      select 1 from public.job_applications ja
      where ja.id = generated_cvs.application_id
      and ja.user_id = auth.uid()
    )
  );

create policy "Users can delete own generated_cvs"
  on public.generated_cvs for delete
  using (
    exists (
      select 1 from public.job_applications ja
      where ja.id = generated_cvs.application_id
      and ja.user_id = auth.uid()
    )
  );

-- ==========================================
-- Storage Buckets Setup (Supabase Storage)
-- ==========================================

-- Insert storage buckets if not exists
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false), ('generated', 'generated', false)
on conflict (id) do nothing;

-- Storage RLS Policies
create policy "Users can upload CV to cvs bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'cvs'
    and auth.role() = 'authenticated'
  );

create policy "Users can read own CV from cvs bucket"
  on storage.objects for select
  using (
    bucket_id = 'cvs'
    and auth.role() = 'authenticated'
  );

create policy "Users can upload to generated bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'generated'
    and auth.role() = 'authenticated'
  );

create policy "Users can read from generated bucket"
  on storage.objects for select
  using (
    bucket_id = 'generated'
    and auth.role() = 'authenticated'
  );
