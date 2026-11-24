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

-- -----------------------------------------------------------------------------
-- Samtykke (lagt til 2026-11-24). Trygt å kjøre flere ganger.
-- Når hver enkelt sa ja, og til hvilken tekst (se SAMTYKKE_VERSJON i
-- api/venteliste.js). Rader fra før samtykkeboksen kom, har tomme felter.
-- -----------------------------------------------------------------------------
alter table public.venteliste add column if not exists samtykke_tid     timestamptz;
alter table public.venteliste add column if not exists samtykke_versjon text;

-- -----------------------------------------------------------------------------
-- Sletting etter lagringstiden i personvernerklæringen (bare-kylling/personvern.html).
-- Kjøres for hånd i SQL Editor. Ikke kjør dette før du mener det – det kan ikke angres.
--
-- 1) 30 dager etter at lanserings-SMS-en er sendt: tøm hele lista.
--      delete from public.venteliste;
--
-- 2) Uten lansering: numre som har ligget på lista i over 12 måneder.
--      delete from public.venteliste where opprettet < now() - interval '12 months';
-- -----------------------------------------------------------------------------
