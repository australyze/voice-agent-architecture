-- Session execution history for HU #011.
-- Apply with Supabase CLI (`supabase db push`) or psql against PostgreSQL.

create table if not exists sessions (
  id uuid primary key,
  agent_id text not null,
  channel text not null default 'voice' check (channel = 'voice'),
  external_channel_id text,
  trace_id text,
  business_status text not null check (business_status in ('initiated', 'active', 'completed', 'failed')),
  media_status text not null check (media_status in ('idle', 'connecting', 'active', 'ended')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  start_idempotency_key text,
  end_idempotency_key text
);

create unique index if not exists sessions_external_channel_id_uidx
  on sessions (external_channel_id)
  where external_channel_id is not null;

create index if not exists sessions_trace_id_idx on sessions (trace_id);
create index if not exists sessions_started_at_idx on sessions (started_at desc);
create index if not exists sessions_created_at_idx on sessions (created_at desc);

create table if not exists conversation_turns (
  id uuid primary key,
  session_id uuid not null references sessions (id) on delete cascade,
  sequence_number integer not null,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  created_at timestamptz not null,
  idempotency_key text not null unique
);

create index if not exists conversation_turns_session_id_idx on conversation_turns (session_id);

create table if not exists tool_calls (
  id uuid primary key,
  session_id uuid not null references sessions (id) on delete cascade,
  interaction_id text,
  tool_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'timed_out', 'denied')),
  arguments jsonb not null default '{}'::jsonb,
  result jsonb,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_ms integer,
  error_class text,
  created_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create index if not exists tool_calls_session_id_idx on tool_calls (session_id);

create table if not exists execution_events (
  id uuid primary key,
  session_id uuid not null references sessions (id) on delete cascade,
  trace_id text not null,
  interaction_id text,
  kind text not null,
  name text not null,
  status text not null check (status in ('ok', 'error')),
  occurred_at timestamptz not null,
  duration_ms integer,
  metadata jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create index if not exists execution_events_session_id_idx on execution_events (session_id);
create index if not exists execution_events_occurred_at_idx on execution_events (occurred_at);
create index if not exists execution_events_trace_id_idx on execution_events (trace_id);

alter table sessions enable row level security;
alter table conversation_turns enable row level security;
alter table tool_calls enable row level security;
alter table execution_events enable row level security;

-- No anonymous policies: the public/anon key cannot read demo history.
-- The backend service role bypasses RLS.
