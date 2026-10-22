-- AuditorAI tenant store (ticket #53) — Supabase Postgres, region ca-central-1.
-- Apply order: 0001 (schema) -> 0002 (policies) -> 0003 (roles/grants).
-- The operator applies these to the live project; an agent never does.
--
-- Vocabulary: the ticket's "Workspace" is a row in `workspaces`. One workspace
-- == one isolation boundary == what docs/research/enterprise-gap-audit.md calls
-- a "tenant". `workspace_members` holds the membership edge;
-- `workspace_credentials` holds rotatable / revocable bearer credentials.
-- A credential is stored as workspaceHash(key) = sha256(key) truncated to 16
-- hex chars — the SAME derivation the legacy KV namespace uses
-- (src/lib/persistence/store.ts:236-240), so the migration can backfill it
-- and the app computes it once (no second derivation point).
--
-- Every table below is a TENANT TABLE: RLS is ENABLED and FORCED on it in
-- 0002_rls_policies.sql.
--
-- Payloads: each tenant record family keeps its legacy JSON document verbatim
-- in a `payload jsonb` column; only the columns that carry MEANING (ordering,
-- uniqueness, foreign keys) are real columns. The documented size caps are
-- enforced at the write path, not here: the 512 000-byte per-artifact cap
-- (src/lib/persistence/artifact-trail.ts:10,44-47) is asserted by the Postgres
-- repository before the insert (M3, src/lib/db/tenant-store.ts:366-369), while
-- the 500 KB attachment cap (src/domain/types.ts:20-22) is enforced at intake
-- (src/lib/intake.ts:46-48), NOT in the repository; so no DB-level byte
-- constraint is declared here.
--
-- Write-once issue revisions are expressed by the primary key of
-- `audit_issues` (revision is part of the key): a revision can never be
-- renumbered or overwritten. Pruned artifact trails are expressed by the
-- separate `artifact_summaries` table (one row per pruned (project, audit)).

create table if not exists public.workspaces (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null default '',
  region           text        not null default 'ca-central-1',
  -- Legacy KV namespace anchor (16-hex workspaceHash). Null for workspaces
  -- created natively in Postgres. Makes the migration idempotent.
  legacy_key_hash  text        unique,
  created_at       timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  subject_id    text        not null,
  role          text        not null default 'member',
  created_at    timestamptz not null default now(),
  primary key (workspace_id, subject_id)
);

create table if not exists public.workspace_credentials (
  credential_hash  text        primary key,
  workspace_id     uuid        not null references public.workspaces(id) on delete cascade,
  subject_id       text        not null,
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  rotated_at       timestamptz
);
create index if not exists workspace_credentials_workspace_idx
  on public.workspace_credentials (workspace_id);
create index if not exists workspace_credentials_subject_idx
  on public.workspace_credentials (subject_id);

-- Project mirrors src/domain/types.ts:73-82 field-for-field, except that
-- `workspace_key_hash` is replaced by the workspace_id foreign key.
create table if not exists public.projects (
  workspace_id    uuid        not null references public.workspaces(id) on delete cascade,
  project_id      text        not null,
  metadata        jsonb       not null,
  stage_selection jsonb       not null,
  input_values    jsonb       not null,
  created_at      timestamptz not null,
  updated_at      timestamptz not null,
  primary key (workspace_id, project_id)
);
create index if not exists projects_workspace_updated_idx
  on public.projects (workspace_id, updated_at desc);

-- Audit mirrors AuditResult (src/domain/types.ts:251-296); `payload` is the
-- frozen JSON document, `ran_at` is the ordering key
-- (src/lib/persistence/project-store.ts:46 sorts by ran_at descending).
create table if not exists public.audits (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  project_id    text        not null,
  audit_id      text        not null,
  ran_at        timestamptz not null,
  payload       jsonb       not null,
  primary key (workspace_id, project_id, audit_id)
);
create index if not exists audits_workspace_project_ran_idx
  on public.audits (workspace_id, project_id, ran_at desc);

-- Issued revision (src/domain/types.ts:301-306). The revision number is part
-- of the key: it is the write-once lineage (ADR-0004).
create table if not exists public.audit_issues (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  project_id    text        not null,
  audit_id      text        not null,
  revision      integer     not null,
  issued_at     timestamptz not null,
  issued_by     text        not null default 'auditor',
  payload       jsonb       not null,
  primary key (workspace_id, project_id, audit_id, revision)
);

-- Attachment mirrors src/domain/types.ts:55-64; data_url stays inline
-- (blob storage is a separate ticket, out of scope per grilling §E).
create table if not exists public.attachments (
  workspace_id   uuid        not null references public.workspaces(id) on delete cascade,
  project_id     text        not null,
  attachment_id  text        not null,
  created_at     timestamptz not null,
  payload        jsonb       not null,
  primary key (workspace_id, project_id, attachment_id)
);

-- One row per artifact of a trail; `seq` is the global write counter encoded
-- in the legacy key tail (src/lib/persistence/keys.ts:23-30, artifactSeqOf at
-- :45-48) and is the trail ordering key
-- (src/lib/persistence/artifact-trail.ts:68-73).
create table if not exists public.artifacts (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  project_id    text        not null,
  audit_id      text        not null,
  node_id       text        not null,
  seq           integer     not null,
  payload       jsonb       not null,
  primary key (workspace_id, project_id, audit_id, node_id, seq)
);

-- The retained record of a PRUNED trail (src/lib/persistence/artifact-trail.ts:19-26,
-- :87-105). One row per (project, audit).
create table if not exists public.artifact_summaries (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  project_id    text        not null,
  audit_id      text        not null,
  pruned_at     timestamptz not null,
  payload       jsonb       not null,
  primary key (workspace_id, project_id, audit_id)
);
