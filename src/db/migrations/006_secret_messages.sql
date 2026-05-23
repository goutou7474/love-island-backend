create table secret_messages (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  title text not null,
  content text not null,
  open_mode text not null check (open_mode in ('now', 'date', 'anniversary')),
  open_at date,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index secret_messages_couple_id_idx on secret_messages(couple_id);
create index secret_messages_to_user_id_idx on secret_messages(to_user_id);
