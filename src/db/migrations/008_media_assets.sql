create table media_assets (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  owner_user_id uuid not null references users(id) on delete cascade,
  filename text not null,
  content_type text not null,
  byte_size integer not null,
  storage_key text not null unique,
  read_token text not null unique,
  created_at timestamptz not null default now()
);

create index media_assets_couple_created_idx on media_assets (couple_id, created_at desc);
