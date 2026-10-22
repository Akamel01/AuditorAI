-- Roles and grants (ticket #53).
-- The tenant connection must run as a role that is NOT the table owner, NOT a
-- superuser and NOT BYPASSRLS — otherwise every policy is a no-op
-- (grilling R4 / risk R8: "RLS is bypassed because the app connects as the
-- table owner or with the service-role key").
--
-- The application sets the role TRANSACTION-LOCALLY on every transaction
-- (`set local role auditorai_app`), so the guarantee does not depend on which
-- role the platform-injected connection string happens to name.
--
-- The role OWNS NOTHING: it receives only USAGE on the schema, DML on the nine
-- tenant tables and EXECUTE on the three claim helpers. Nothing in this file
-- creates an object AS auditorai_app, so it can never become a table owner
-- (and the forced policies in 0002 therefore always apply to it).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'auditorai_app') then
    create role auditorai_app login password null
      nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$$;

-- The migration executor must be able to assume the app role.
do $$
begin
  if not exists (
    select 1 from pg_auth_members m
    join pg_roles r on r.oid = m.roleid
    join pg_roles g on g.oid = m.member
    where r.rolname = 'auditorai_app' and g.rolname = current_user
  ) then
    execute format('grant auditorai_app to %I', current_user);
  end if;
end
$$;

grant usage on schema public to auditorai_app;

grant select, insert, update, delete on
  public.workspaces,
  public.workspace_members,
  public.workspace_credentials,
  public.projects,
  public.audits,
  public.audit_issues,
  public.attachments,
  public.artifacts,
  public.artifact_summaries
  to auditorai_app;

grant execute on function public.app_claim_subject() to auditorai_app;
grant execute on function public.app_claim_workspace_id() to auditorai_app;
grant execute on function public.app_claim_credential_hash() to auditorai_app;

-- The operator sets the password OUT OF BAND (never in this file):
--   alter role auditorai_app password '<operator-chosen>';
-- and points POSTGRES_URL at that role. See supabase/README.md.
