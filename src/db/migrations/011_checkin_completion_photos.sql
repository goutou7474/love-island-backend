alter table checkin_completions
  add column photos jsonb not null default '[]'::jsonb;
