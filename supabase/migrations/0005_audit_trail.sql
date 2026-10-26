-- 0005_audit_trail.sql
-- Append-only, hash-chained per-workspace audit trail (ticket #55, G-3).
-- Operator applies by hand, in order after 0001..0004. Idempotent and re-runnable.
-- Append-only for the application: no update/delete policy and those privileges
-- are revoked from auditorai_app. The table owner retains out-of-band access;
-- owner tampering is detectable via verifyAuditTrail and the signed export.

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
    prev_hash ~ '^[0-9a-f]{64}$' and
    payload_hash ~ '^[0-9a-f]{64}$' and
    entry_hash ~ '^[0-9a-f]{64}$'
  )
);

create index if not exists audit_trail_entries_recorded_idx
  on public.audit_trail_entries (workspace_id, recorded_at desc);

create index if not exists audit_trail_entries_project_idx
  on public.audit_trail_entries (workspace_id, project_id, seq);

ALTER TABLE public.audit_trail_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail_entries FORCE ROW LEVEL SECURITY;

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
