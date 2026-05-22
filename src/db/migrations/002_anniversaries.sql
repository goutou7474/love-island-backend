create table anniversaries (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null,
  date date not null,
  calendar text not null check (calendar in ('solar', 'lunar')),
  lunar_date text,
  repeat text not null check (repeat in ('none', 'yearly')),
  kind text not null check (kind in ('love', 'birthday', 'wedding', 'proposal', 'engagement', 'custom')),
  owner text not null check (owner in ('owner', 'partner', 'both')),
  icon text not null,
  color text not null,
  is_main boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index anniversaries_default_unique_idx
  on anniversaries(couple_id, kind, owner);

create index anniversaries_couple_id_idx on anniversaries(couple_id);

