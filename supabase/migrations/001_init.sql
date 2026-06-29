-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text unique,
  password_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sources
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  url text not null,
  category text default 'Общее',
  enabled boolean default true,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Digest settings
create table if not exists digest_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  send_time text default '09:00',
  timezone text default 'Europe/Moscow',
  language text default 'ru',
  format text default 'executive',
  max_items int default 15,
  auto_send_enabled boolean default true,
  bitrix_chat_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bitrix24 connection
create table if not exists bitrix_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  bitrix_domain text,
  member_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  bot_id text,
  status text default 'disconnected',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Digest runs history
create table if not exists digest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  run_type text not null,
  status text not null,
  period_from timestamptz,
  period_to timestamptz,
  sources_count int default 0,
  articles_found int default 0,
  articles_used int default 0,
  message_text text,
  error_text text,
  bitrix_message_id text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
