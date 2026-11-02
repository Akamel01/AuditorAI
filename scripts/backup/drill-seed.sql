begin;
insert into public.workspaces (id, name, region, legacy_key_hash, created_at) values
 ('11111111-1111-4111-8111-111111111111','drill-a','ca-central-1','aaaaaaaaaaaaaaaa','2026-11-01T00:00:00Z'),
 ('22222222-2222-4222-8222-222222222222','drill-b','ca-central-1','bbbbbbbbbbbbbbbb','2026-11-01T00:00:01Z');
insert into public.workspace_members (workspace_id, subject_id, role, created_at, status, email, accepted_at) values
 ('11111111-1111-4111-8111-111111111111','subject-a','owner','2026-11-01T00:00:02Z','active','a@drill.invalid','2026-11-01T00:00:02Z'),
 ('22222222-2222-4222-8222-222222222222','subject-b','owner','2026-11-01T00:00:03Z','active','b@drill.invalid','2026-11-01T00:00:03Z');
insert into public.workspace_credentials (credential_hash, workspace_id, subject_id, created_at) values
 ('cccccccccccccccc','11111111-1111-4111-8111-111111111111','subject-a','2026-11-01T00:00:04Z'),
 ('dddddddddddddddd','22222222-2222-4222-8222-222222222222','subject-b','2026-11-01T00:00:05Z');
insert into public.projects (workspace_id, project_id, metadata, stage_selection, input_values, created_at, updated_at, updated_by) values
 ('11111111-1111-4111-8111-111111111111','project-a','{}','{}','{}','2026-11-01T00:00:06Z','2026-11-01T00:00:06Z','subject-a'),
 ('22222222-2222-4222-8222-222222222222','project-b','{}','{}','{}','2026-11-01T00:00:07Z','2026-11-01T00:00:07Z','subject-b');
insert into public.audits (workspace_id, project_id, audit_id, ran_at, payload, produced_by) values
 ('11111111-1111-4111-8111-111111111111','project-a','audit-a','2026-11-01T00:00:08Z','{}','subject-a'),
 ('22222222-2222-4222-8222-222222222222','project-b','audit-b','2026-11-01T00:00:09Z','{}','subject-b');
insert into public.audit_issues (workspace_id, project_id, audit_id, revision, issued_at, issued_by, payload) values
 ('11111111-1111-4111-8111-111111111111','project-a','audit-a',1,'2026-11-01T00:00:10Z','auditor','{}'),
 ('22222222-2222-4222-8222-222222222222','project-b','audit-b',1,'2026-11-01T00:00:11Z','auditor','{}');
insert into public.attachments (workspace_id, project_id, attachment_id, created_at, payload, uploaded_by) values
 ('11111111-1111-4111-8111-111111111111','project-a','attachment-a','2026-11-01T00:00:12Z','{}','subject-a'),
 ('22222222-2222-4222-8222-222222222222','project-b','attachment-b','2026-11-01T00:00:13Z','{}','subject-b');
insert into public.artifacts (workspace_id, project_id, audit_id, node_id, seq, payload) values
 ('11111111-1111-4111-8111-111111111111','project-a','audit-a','node-a',1,'{}'),
 ('22222222-2222-4222-8222-222222222222','project-b','audit-b','node-b',1,'{}');
insert into public.artifact_summaries (workspace_id, project_id, audit_id, pruned_at, payload) values
 ('11111111-1111-4111-8111-111111111111','project-a','audit-a','2026-11-01T00:00:14Z','{}'),
 ('22222222-2222-4222-8222-222222222222','project-b','audit-b','2026-11-01T00:00:15Z','{}');
insert into public.audit_trail_entries (workspace_id, seq, recorded_at, actor, action, subject_type, subject_id, project_id, audit_id, evidence_refs, payload, payload_hash, prev_hash, entry_hash) values
 ('11111111-1111-4111-8111-111111111111',1,'2026-11-01T00:00:16Z','drill','drill.seed','project','project-a','project-a','audit-a','[]','{}',repeat('a',64),repeat('0',64),repeat('1',64)),
 ('22222222-2222-4222-8222-222222222222',1,'2026-11-01T00:00:17Z','drill','drill.seed','project','project-b','project-b','audit-b','[]','{}',repeat('b',64),repeat('0',64),repeat('2',64));
commit;
