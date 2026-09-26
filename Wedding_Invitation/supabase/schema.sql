create table if not exists public.wedding_wishes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  message text not null check (char_length(btrim(message)) between 1 and 240),
  created_at timestamptz not null default now()
);

alter table public.wedding_wishes enable row level security;

drop policy if exists "Anyone can read wedding wishes" on public.wedding_wishes;
create policy "Anyone can read wedding wishes"
  on public.wedding_wishes for select to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit wedding wishes" on public.wedding_wishes;
create policy "Anyone can submit wedding wishes"
  on public.wedding_wishes for insert to anon, authenticated
  with check (
    char_length(btrim(name)) between 1 and 50
    and char_length(btrim(message)) between 1 and 240
  );

grant select, insert on public.wedding_wishes to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wedding_wishes'
  ) then
    alter publication supabase_realtime add table public.wedding_wishes;
  end if;
end
$$;