create table checkin_completions (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  item_id text not null,
  category_id text not null,
  title text not null,
  completed_at date not null,
  completed_by_user_id uuid not null references users(id) on delete cascade,
  location text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, item_id)
);

create index checkin_completions_couple_id_idx on checkin_completions(couple_id);
create index checkin_completions_completed_at_idx on checkin_completions(completed_at);

