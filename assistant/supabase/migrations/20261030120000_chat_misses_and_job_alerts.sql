-- =====================================================================
-- Two tables for the chat assistant. Run once in the Supabase project the website uses
-- (Supabase > SQL editor, or `supabase db push`).
--
-- chat_misses   messages the chat couldn't understand, without contact details (redact.js),
--               so its rules can learn new words. Kept 180 days (scripts/send-job-alerts.mjs tidies up).
-- job_alerts    job-alert sign-ups from the chat: the email, the search, and the consent record.
--               Pending sign-ups that are never confirmed are removed after 14 days. Unsubscribing
--               clears the email and the search; only the dates stay.
--
-- Row level security is on with no policies: nobody can read or write these tables with the
-- public key. Only the edge functions and the sender (service role key, kept in secrets) can.
-- =====================================================================

create table if not exists public.chat_misses (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  brand text not null check (brand in ('isl', 'as', 'ads')),
  lang text not null default 'en' check (lang in ('en', 'fr')),
  kind text not null check (kind in ('unclear', 'no-match')),
  text text not null check (char_length(text) between 1 and 300),
  page text check (char_length(page) <= 240)
);
create index if not exists chat_misses_created_at on public.chat_misses (created_at desc);
alter table public.chat_misses enable row level security;

create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  brand text not null default 'isl' check (brand in ('isl', 'as', 'ads')),
  lang text not null default 'en' check (lang in ('en', 'fr')),
  email text check (char_length(email) <= 200),
  search jsonb,
  search_key text,                           -- the same search, as text, to spot a repeat sign-up
  label text check (char_length(label) <= 200),
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  token uuid not null unique default gen_random_uuid(),   -- in the confirm and unsubscribe links
  consent_text text,                          -- the exact wording they agreed to (CASL record)
  consent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_sent_at timestamptz,
  sent_ids text[] not null default '{}'       -- jobs already emailed, so a job is never sent twice
);
create index if not exists job_alerts_status on public.job_alerts (status);
create unique index if not exists job_alerts_one_per_search on public.job_alerts (lower(email), search_key) where status <> 'unsubscribed';
alter table public.job_alerts enable row level security;
