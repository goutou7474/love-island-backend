create table wishes (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  category text not null,
  priority integer not null check (priority between 1 and 3),
  note text not null default '',
  added_by_user_id uuid not null references users(id) on delete cascade,
  completed_at date,
  completed_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wishes_couple_id_idx on wishes(couple_id);
create index wishes_completed_at_idx on wishes(completed_at);
