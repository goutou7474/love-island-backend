create table push_subscriptions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions(user_id);
create index push_subscriptions_couple_id_idx on push_subscriptions(couple_id);
