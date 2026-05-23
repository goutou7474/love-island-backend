create table app_settings (
  user_id uuid not null references users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  anniversary_reminder boolean not null default true,
  daily_message_push boolean not null default true,
  partner_activity_notify boolean not null default true,
  app_lock boolean not null default false,
  soft_theme boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, couple_id)
);

create index app_settings_couple_id_idx on app_settings(couple_id);
