-- 0005_audit_trail.sql
-- Append-only, hash-chained per-workspace audit trail (ticket #55, G-3).
-- Operator applies by hand, in order after 0001..0004. Idempotent and re-runnable.
-- No update or delete path exists: no policy, no privilege, and a trigger refuses
-- any mutation attempt.

create table if not exists public.audit_trail_entries (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  seq           bigint      not null,
  recorded_at   timestamptz not null,
  actor         text        not null,
  action        text        not null,
  subject_type  text        not null,
  subject_id    text        not null,
  project_id    text,
  audit_id      text,
  evidence_refs jsonb       not null default '[]'::jsonb,
  payload       jsonb       not null default '{}'::jsonb,
  payload_hash  text        not null,
  prev_hash     text        not null,
  entry_hash    text        not null,
  primary key (workspace_id, seq),
  constraint audit_trail_entries_seq_positive   check (seq >= 1),
  constraint audit_trail_entries_refs_array     check (jsonb_typeof(evidence_refs) = 'array'),
  constraint audit_trail_entries_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint audit_trail_entries_hash_shape     check (
    length(prev_hash) = 64 and length(payload_hash) = 64 and length(entry_hash) = 64
  )
);

create index if not exists audit_trail_entries_recorded_idx
  on public.audit_trail_entries (workspace_id, recorded_at desc);

create index if not exists audit_trail_entries_project_idx
  on public.audit_trail_entries (workspace_id, project_id, seq);

alter table public.audit_trail_entries enable row level security;
alter table public.audit_trail_entries force row level security;

drop policy if exists audit_trail_entries_select on public.audit_trail_entries;
create policy audit_trail_entries_select on public.audit_trail_entries for select
  using (workspace_id = public.app_claim_workspace_id());

drop policy if exists audit_trail_entries_insert on public.audit_trail_entries;
create policy audit_trail_entries_insert on public.audit_trail_entries for insert
  with check (workspace_id = public.app_claim_workspace_id());

revoke all on public.audit_trail_entries from public;
revoke all on public.audit_trail_entries from auditorai_app;
grant select, insert on public.audit_trail_entries to auditorai_app;
revoke update, delete, truncate, references, trigger
  on public.audit_trail_entries from auditorai_app;

create or replace function public.audit_trail_entries_no_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_trail_entries is append-only (attempted %)', tg_op;
end;
$$;

drop trigger if exists audit_trail_entries_no_mutation on public.audit_trail_entries;
create trigger audit_trail_entries_no_mutation
  before update or delete on public.audit_trail_entries
  for each row
  execute function public.audit_trail_entries_no_mutation();
