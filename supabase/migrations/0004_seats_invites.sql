-- AuditorAI tenant store, ticket #54 — seats, membership state, actor columns
-- and the RLS hardening of the three holes in 0002_rls_policies.sql.
--
-- Apply AFTER 0001 -> 0002 -> 0003. The operator applies this file by hand;
-- no agent ever applies it (supabase/README.md:8-9).
--
-- Re-runnable: every statement is idempotent (add column if not exists,
-- drop policy if exists + create policy, create or replace function), exactly
-- like 0002. A partial apply is repaired by running the file again.

-- ---------- 1. the seat allowance ----------
-- The allowance is the entitlement the OPERATOR provisions; the app enforces
-- it at the invite and may only READ it (OD19).
alter table public.workspaces
  add column if not exists seat_count integer not null default 1;

-- 1b. RLS HOLE 1 (OD5.1) + OD19: the app role may READ seat_count and may
-- never WRITE it. A table-level grant overrides a column-level revoke, so the
-- table grants are revoked first and only the columns the app needs are given
-- back. The OPERATOR (the platform's privileged owner role) keeps full
-- UPDATE/INSERT and provisions the allowance out of band.
revoke update on public.workspaces from auditorai_app;
grant  update (name, region) on public.workspaces to auditorai_app;
revoke insert on public.workspaces from auditorai_app;
grant  insert (id, name, region, legacy_key_hash) on public.workspaces to auditorai_app;

-- ---------- 2. membership state ----------
-- status: 'active'   = an accepted member (holds a seat)
--         'pending'  = an invitation (holds a seat until expires_at)
--         'revoked'  = the member's access ended (the seat is free again)
-- The primary key (workspace_id, subject_id) is UNCHANGED.
alter table public.workspace_members
  add column if not exists status      text        not null default 'active',
  add column if not exists email       text,
  add column if not exists invited_by  text,
  add column if not exists expires_at  timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists revoked_at  timestamptz;

-- 2b. the role vocabulary (OD14). NOT VALID: the new and updated rows are
-- checked from now on; the operator may VALIDATE it after inspecting the
-- historical rows (there are none outside 'member'/'admin'/'owner').
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'workspace_members_role_check'
       and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_role_check
      check (role in ('owner', 'admin', 'member')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'workspace_members_status_check'
       and conrelid = 'public.workspace_members'::regclass
  ) then
    alter table public.workspace_members
      add constraint workspace_members_status_check
      check (status in ('active', 'pending', 'revoked')) not valid;
  end if;
end
$$;

-- A pending invitation is a member row whose subject is a PLACEHOLDER
-- ('pending:<16-hex>', derived from the invited email by
-- src/domain/actor.ts:pendingSubjectFor) — there is no user yet. The
-- placeholder is deterministic, so a re-invite updates the same row instead
-- of consuming a second seat.
create index if not exists workspace_members_email_idx
  on public.workspace_members (email);
create unique index if not exists workspace_members_pending_email_uniq
  on public.workspace_members (workspace_id, email)
  where status = 'pending';

-- ---------- 3. the actor columns (OD13) ----------
-- The actor NEVER rides inside a payload document: it is a SIBLING column of
-- payload in the same table, so the frozen bytes of audits.payload and
-- audit_issues.payload are unchanged by the presence of an actor.
-- public.audit_issues.issued_by already exists (0001) and is already a
-- sibling of audit_issues.payload; no change.
alter table public.projects
  add column if not exists updated_by  text;
alter table public.audits
  add column if not exists produced_by text;
alter table public.attachments
  add column if not exists uploaded_by text;

-- ---------- 4. two more claim helpers ----------
-- Same shape as app_claim_subject(): they read the claims GUC and reference
-- NO table — the design rule of 0002 ("NO POLICY REFERENCES ANOTHER TABLE").
-- The field names are fixed in src/lib/db/claim.ts (M1).
create or replace function public.app_claim_role() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
create or replace function public.app_claim_email() returns text language sql stable parallel safe set search_path = pg_catalog, public as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email' $$;

-- ---------- 5. the membership policies ----------
-- SELECT (RLS HOLE 2, OD5.2 + OD20-N2): a member reads the member list of
-- their OWN workspace. Outside its own workspace a caller may see only the
-- rows bound to its OWN verified email (its invitation, and any membership it
-- already accepted), never another member's row. The sign-in surface needs the
-- own-email branch to resolve a returning member (and to refuse a silent
-- rows[0] when the email belongs to several workspaces); the workspace branch
-- is what makes the member list a per-workspace list.
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members for select
  using (workspace_id = public.app_claim_workspace_id()
         or email = public.app_claim_email());

-- INSERT (RLS HOLE 3, OD5.3 + OD14): the inviter inserts a member row for
-- ANOTHER subject, with the role carried in the claim. 'admin' is granted only
-- by an OWNER; an admin inviter may grant 'member' only. 'owner' is NEVER
-- granted by the app. The self-insert branch (subject_id = the claim subject)
-- is the KV->Postgres backfill's legacy subject and carries 'member' only.
drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members for insert
  with check (workspace_id = public.app_claim_workspace_id()
              and role <> 'owner'
              and (
                (subject_id = public.app_claim_subject() and role = 'member')
                or (public.app_claim_role() = 'owner' and role in ('member', 'admin'))
                or (public.app_claim_role() = 'admin' and role = 'member')
              ));

-- UPDATE: the invitee binds its OWN pending invitation (status + subject_id
-- only). The ROLE is not writable: the app role holds no UPDATE privilege on
-- workspace_members.role (5b below), so no policy expression can change a
-- role. An OWNER administers the workspace's rows.
drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members for update
  using (workspace_id = public.app_claim_workspace_id()
         and (
           subject_id = public.app_claim_subject()
           or (email = public.app_claim_email() and status = 'pending')
           or public.app_claim_role() = 'owner'
         ))
  with check (workspace_id = public.app_claim_workspace_id());

-- DELETE: a member may leave (the seat is released); an owner may remove one.
drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members for delete
  using (workspace_id = public.app_claim_workspace_id()
         and (
           subject_id = public.app_claim_subject()
           or (email = public.app_claim_email() and status = 'pending')
           or public.app_claim_role() = 'owner'
         ));

-- ---------- 6. the column-level privileges ----------
-- 6a. OD14: the app role may NEVER update the role. A table-level UPDATE
-- grant overrides a column-level revoke, so the table grant is revoked and
-- only the columns the app really writes are given back. `role` is absent
-- from the list ON PURPOSE — that is the whole guarantee. Postgres has no
-- column-scoped policies, so the privilege (not a policy expression) is what
-- makes a role change impossible for the app role.
revoke update on public.workspace_members from auditorai_app;
grant  update (subject_id, status, email, invited_by, expires_at, accepted_at, revoked_at)
  on public.workspace_members to auditorai_app;

-- 6b. the grants for the new helpers.
grant execute on function public.app_claim_role()  to auditorai_app;
grant execute on function public.app_claim_email() to auditorai_app;
