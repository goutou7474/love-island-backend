create table memories (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  memory_date date not null,
  location text not null default '',
  mood text not null,
  note text not null default '',
  photos jsonb not null default '[]'::jsonb,
  created_by_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memories_couple_id_idx on memories(couple_id);
create index memories_memory_date_idx on memories(memory_date);
