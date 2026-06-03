-- Table des réservations de fours
create table if not exists public.reservations (
  id          uuid primary key default gen_random_uuid(),
  oven_id     uuid not null references public.ovens(id) on delete cascade,
  demandeur   text not null,
  projet      text,
  date_debut  date not null,
  heure_debut time not null,
  date_fin    date not null,
  heure_fin   time not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Index pour les requêtes par date
create index if not exists reservations_date_debut_idx on public.reservations (date_debut);
create index if not exists reservations_oven_id_idx on public.reservations (oven_id);

-- RLS : lecture et écriture publiques (adapter selon votre politique auth)
alter table public.reservations enable row level security;

create policy "Allow all" on public.reservations
  for all using (true) with check (true);
