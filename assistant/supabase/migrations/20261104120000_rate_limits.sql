-- =====================================================================
-- Rate limits that every copy of an edge function shares (assistant/supabase/functions/_shared/guard.js).
-- Run once in the Supabase project (Supabase > SQL editor, or `supabase db push`).
--
-- Why a table: an edge function runs as many short-lived copies at once, and each copy's memory is
-- wiped when it restarts, so a count kept in memory can be dodged just by waiting or by luck. Counted
-- here, a limit holds across every copy and every restart.
--
-- What's stored: one row per counter, holding a hash of what's being counted (never the IP address or
-- email itself), when the current window started, and how many hits it has had. Rows older than a
-- day are removed as new hits come in.
--
-- Row level security is on with no policies, and only the service role may call the function, so the
-- public key can neither read the counts nor reset them.
-- =====================================================================

create table if not exists public.rate_limits (
  key text primary key check (char_length(key) <= 120),
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.rate_limits enable row level security;

-- Counts one hit against a key and says whether the key is now over its limit.
-- A fixed window: the count starts again once window_seconds have passed since the window began.
-- The insert-or-update happens in one statement, so two hits at the same moment can't both slip through.
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into n;
  -- Tidy up now and then (about one call in 200), so the table never grows past a day of counters
  if random() < 0.005 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return n > p_max;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
