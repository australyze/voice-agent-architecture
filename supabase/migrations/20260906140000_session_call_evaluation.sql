-- HU #012: persist deterministic session call-evaluation on sessions.

alter table sessions
  add column if not exists evaluation jsonb;

-- Anonymous RLS policies remain absent (deny by default).
