-- Multiple digests per user, each with its own schedule, AI settings, sources and messenger targets.

create table if not exists digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null default 'Основной',
  send_time text default '09:00',
  digest_times jsonb default '["09:00"]',
  timezone text default 'Europe/Moscow',
  language text default 'ru',
  format text default 'executive',
  max_items int default 15,
  auto_send_enabled boolean default true,
  focus_prompt text,
  ai_provider text default 'openai',
  openai_api_key text,
  groq_api_key text,
  gemini_api_key text,
  custom_api_url text,
  custom_api_key text,
  custom_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists digests_user on digests(user_id);

-- Many-to-many: a source can feed multiple digests
create table if not exists digest_sources (
  digest_id uuid references digests(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  primary key (digest_id, source_id)
);

-- Messenger targets (telegram/max/bitrix24) move from per-user to per-digest
alter table integrations add column if not exists digest_id uuid references digests(id) on delete cascade;

alter table digest_runs add column if not exists digest_id uuid references digests(id) on delete cascade;

-- One-off backfill: create a "Основной" digest per existing user from digest_settings,
-- attach all their sources, and repoint integrations/digest_runs at it.
do $$
declare
  r record;
  new_digest_id uuid;
begin
  for r in select * from digest_settings loop
    insert into digests (
      user_id, name, send_time, digest_times, timezone, language, format, max_items,
      auto_send_enabled, focus_prompt, ai_provider, openai_api_key, groq_api_key,
      gemini_api_key, custom_api_url, custom_api_key, custom_model, created_at, updated_at
    ) values (
      r.user_id, 'Основной', r.send_time, to_jsonb(r.digest_times), r.timezone, r.language, r.format, r.max_items,
      r.auto_send_enabled, r.focus_prompt, r.ai_provider, r.openai_api_key, r.groq_api_key,
      r.gemini_api_key, r.custom_api_url, r.custom_api_key, r.custom_model, r.created_at, r.updated_at
    )
    returning id into new_digest_id;

    insert into digest_sources (digest_id, source_id)
    select new_digest_id, id from sources where user_id = r.user_id
    on conflict do nothing;

    update integrations set digest_id = new_digest_id where user_id = r.user_id and digest_id is null;
    update digest_runs set digest_id = new_digest_id where user_id = r.user_id and digest_id is null;
  end loop;
end $$;

-- Repoint the primary key from (id, user_id) to (id, digest_id) now that every row has a digest_id
alter table integrations drop constraint if exists integrations_pkey;
alter table integrations alter column digest_id set not null;
alter table integrations add primary key (id, digest_id);
