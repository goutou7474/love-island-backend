create table users (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table couples (
  id uuid primary key,
  name text not null,
  owner_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table couple_members (
  couple_id uuid not null references couples(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create table couple_invites (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  code text not null unique,
  created_by_user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_by_user_id uuid references users(id) on delete set null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index couple_members_couple_id_idx on couple_members(couple_id);
create index couple_invites_couple_id_idx on couple_invites(couple_id);

