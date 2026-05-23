alter table users
  add column city text not null default '',
  add column avatar_url text not null default '';

alter table couples
  add column start_date date not null default date '2026-05-28';

create table custom_checklist_items (
  id uuid primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  category_id text not null,
  title text not null,
  description text not null default '',
  created_by_user_id uuid not null references users(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_checklist_items_couple_id_idx on custom_checklist_items(couple_id);
create index custom_checklist_items_active_idx on custom_checklist_items(couple_id, archived_at);

alter table wishes
  add column completion_note text not null default '',
  add column completion_photos jsonb not null default '[]'::jsonb;
