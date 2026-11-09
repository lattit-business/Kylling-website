-- =============================================================================
-- Bare Kylling – venteliste (Supabase)
-- Kjør én gang i Supabase: SQL Editor → New query → lim inn → Run.
--
-- Nummeret lagres som +47XXXXXXXX (norsk mobil). Samme nummer lagres bare én gang.
-- Row Level Security er på uten regler: den offentlige anon-nøkkelen kan verken
-- lese eller skrive. Bare Vercel-funksjonen api/venteliste.js (med den hemmelige
-- nøkkelen) kan legge inn numre.
-- =============================================================================

create table if not exists public.venteliste (
  id         bigint generated always as identity primary key,
  telefon    text not null unique check (telefon ~ '^\+47[49][0-9]{7}$'),
  kilde      text not null default 'venteliste',
  opprettet  timestamptz not null default now()
);

alter table public.venteliste enable row level security;
revoke all on table public.venteliste from anon, authenticated;
