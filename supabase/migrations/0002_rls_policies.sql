-- Row-level security for the tenant store (ticket #53).
--
-- DESIGN RULE (orchestrator D3e): NO POLICY REFERENCES ANOTHER TABLE.
-- A policy that reads `workspace_members` (which itself has RLS) risks the
-- "infinite recursion detected in policy" runtime error. This file therefore
-- contains zero table references in any policy expression: every predicate is a
-- function of the claims document alone. A policy graph with no edges cannot
-- contain a cycle, so recursion is impossible by construction, not by luck.
--
-- The membership fact is still enforced BY THE DATABASE: the resolution step
-- reads workspace_members under this file's own policy, which makes the row
-- visible only to a session whose claim names that subject and that workspace
-- (see the workspace_members_select policy below). A session that is not a
-- member sees zero membership rows, so the credential cannot be bound to a
-- workspace it does not belong to.
--
-- TWO transaction-local GUCs carry the identity:
--   request.jwt.claims      -> {"sub": "<subject>", "workspace_id": "<uuid>"}
--   request.credential_hash -> the presented credential's 16-hex hash
-- Both are set with set_config(..., true) INSIDE the transaction that uses
-- them (the Supabase pooler is transaction-pooled, so a session-level SET
-- would be discarded between transactions).

-- ---------- claim helpers (STABLE, fixed search_path, no table access) ----------

create or replace function public.app_claim_subject() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub' $$;

create or replace function public.app_claim_workspace_id() returns uuid language sql stable parallel safe set search_path = pg_catalog, public as $$ select case when v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v::uuid else null end from (select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'workspace_id' as v) s $$;

-- The presented credential's hash. Set with the same transaction-local
-- set_config(..., true) as the claims, one statement before the lookup.
create or replace function public.app_claim_credential_hash() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.credential_hash', true), '') $$;

-- ---------- ENABLE + FORCE on every tenant table ----------
-- FORCE is what makes the policies bite: without it the table OWNER bypasses
-- them (grilling R3, risk R8). The literal uppercase form is required by the
-- acceptance grep (F.7 / F.14).

ALTER TABLE public.workspaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_issues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_issues       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_summaries FORCE ROW LEVEL SECURITY;

-- ---------- workspaces ----------
drop policy if exists workspaces_select on public.workspaces;
drop policy if exists workspaces_insert on public.workspaces;
drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_select on public.workspaces for select
  using (id = public.app_claim_workspace_id());
create policy workspaces_insert on public.workspaces for insert
  with check (id = public.app_claim_workspace_id());
create policy workspaces_update on public.workspaces for update
  using (id = public.app_claim_workspace_id())
  with check (id = public.app_claim_workspace_id());

-- ---------- workspace_members ----------
-- A member sees their OWN membership rows, and only in the workspace the
-- server granted. This policy is what makes the membership check in the
-- resolution step a real database check (zero rows => not a member).
drop policy if exists workspace_members_select on public.workspace_members;
drop policy if exists workspace_members_insert on public.workspace_members;
drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_select on public.workspace_members for select
  using (subject_id = public.app_claim_subject()
         and workspace_id = public.app_claim_workspace_id());
create policy workspace_members_insert on public.workspace_members for insert
  with check (subject_id = public.app_claim_subject()
              and workspace_id = public.app_claim_workspace_id());
create policy workspace_members_delete on public.workspace_members for delete
  using (subject_id = public.app_claim_subject()
         and workspace_id = public.app_claim_workspace_id());

-- ---------- workspace_credentials ----------
-- Keyed on the PRESENTED credential only. The app sets
-- request.credential_hash to the hash it is verifying, so the row it is
-- looking up is the only credential row it can see. A claims-only policy here
-- would hide the credential row from its own lookup (C1): the resolution
-- transaction would find no row for any credential and the Postgres store
-- would never serve a single workspace. No table is referenced, so this
-- policy cannot recurse.
drop policy if exists workspace_credentials_select on public.workspace_credentials;
drop policy if exists workspace_credentials_insert on public.workspace_credentials;
drop policy if exists workspace_credentials_update on public.workspace_credentials;
create policy workspace_credentials_select on public.workspace_credentials for select
  using (credential_hash = public.app_claim_credential_hash());
create policy workspace_credentials_insert on public.workspace_credentials for insert
  with check (credential_hash = public.app_claim_credential_hash());
create policy workspace_credentials_update on public.workspace_credentials for update
  using (credential_hash = public.app_claim_credential_hash())
  with check (credential_hash = public.app_claim_credential_hash());

-- ---------- the six record tables: one uniform policy set ----------
-- Every predicate is `workspace_id = <the granted workspace>`. The APPLICATION
-- SQL DOES NOT FILTER BY WORKSPACE (architecture §3.6) — isolation is RLS's job.
do $$
declare
  t text;
begin
  foreach t in array array['projects','audits','audit_issues','attachments','artifacts','artifact_summaries'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select using (workspace_id = public.app_claim_workspace_id())', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (workspace_id = public.app_claim_workspace_id())', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (workspace_id = public.app_claim_workspace_id()) with check (workspace_id = public.app_claim_workspace_id())', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (workspace_id = public.app_claim_workspace_id())', t || '_delete', t);
  end loop;
end
$$;
