import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "yaml";

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("backup/restore contract", () => {
  describe("A. backup.yml", () => {
    const raw = read(".github/workflows/backup.yml");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = yaml.parse(raw) as any;
    it("parses", () => expect(doc).toBeTruthy());
    it("cron", () => expect(doc.on.schedule[0].cron).toBe("17 3 * * *"));
    it("workflow_dispatch", () => expect(doc.on.workflow_dispatch).toBeDefined());
    it("permissions", () => expect(doc.permissions.contents).toBe("read"));
    it("concurrency group", () => expect(doc.concurrency.group).toBe("db-backup"));
    it("concurrency cancel false", () => expect(doc.concurrency["cancel-in-progress"]).toBe(false));
    it("timeout 60", () => expect(doc.jobs.backup["timeout-minutes"]).toBe(60));
    it("PG_IMAGE", () => expect(doc.jobs.backup.env.PG_IMAGE).toBe("postgres:17"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = doc.jobs.backup.steps as any[];
    const backupIdx = steps.findIndex((s) => s.id === "backup");
    const uploadIdx = steps.findIndex((s) => s.uses === "actions/upload-artifact@v4");
    it("backup step exists", () => expect(backupIdx).toBeGreaterThanOrEqual(0));
    const backupStep = steps[backupIdx];
    it("backup env secrets", () => {
      expect(backupStep.env.BACKUP_POSTGRES_URL).toContain("secrets.BACKUP_POSTGRES_URL");
      expect(backupStep.env.BACKUP_AGE_RECIPIENT).toContain("vars.BACKUP_AGE_RECIPIENT");
    });
    const upload = steps[uploadIdx];
    it("upload uses v4", () => expect(upload.uses).toBe("actions/upload-artifact@v4"));
    it("retention 30", () => expect(upload.with["retention-days"]).toBe(30));
    it("if-no-files-found error", () => expect(upload.with["if-no-files-found"]).toBe("error"));
    it("compression 0", () => expect(upload.with["compression-level"]).toBe(0));
    it("path", () => expect(upload.with.path).toBe("backup-out/*.tar.age"));
    it("name contains artifact_name", () => expect(String(upload.with.name)).toContain("steps.backup.outputs.artifact_name"));
    it("upload after backup", () => expect(uploadIdx).toBeGreaterThan(backupIdx));
    it("one secrets occurrence", () => expect((raw.match(/secrets\./g) || []).length).toBe(1));
    it("no bad hosts", () => {
      expect(raw).not.toContain("supabase.co");
      expect(raw).not.toContain("pooler.supabase.com");
      expect(raw).not.toContain("/home/oc");
    });
  });

  describe("B. backup.sh", () => {
    const raw = read("scripts/backup/backup.sh");
    it("flags", () => expect(raw).toContain("--format=custom --schema=public --no-owner --no-privileges --compress=9 --no-password"));
    for (const s of ["jsonb_object_agg", "age -r", "::error::", "exit 1", "GITHUB_OUTPUT", "GITHUB_STEP_SUMMARY"]) {
      it(`contains ${s}`, () => expect(raw).toContain(s));
    }
    const iDump = raw.indexOf("pg_dump");
    const iJson = raw.indexOf("jsonb_object_agg");
    const iAge = raw.indexOf("age -r");
    it("order", () => { expect(iDump).toBeLessThan(iJson); expect(iJson).toBeLessThan(iAge); });
    it("no tenant url read", () => {
      expect(raw).not.toContain("${TENANT_POSTGRES_URL");
      expect(raw).not.toContain("$TENANT_POSTGRES_URL");
    });
  });

  describe("C. restore-drill.yml", () => {
    const raw = read(".github/workflows/restore-drill.yml");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = yaml.parse(raw) as any;
    it("pull_request", () => expect(doc.on.pull_request).toBeDefined());
    it("push main", () => expect(doc.on.push.branches).toContain("main"));
    it("workflow_dispatch", () => expect(doc.on.workflow_dispatch).toBeDefined());
    it("permissions", () => expect(doc.permissions.contents).toBe("read"));
    it("concurrency group", () => expect(doc.concurrency.group).toBe("restore-drill-${{ github.ref }}"));
    it("cancel true", () => expect(doc.concurrency["cancel-in-progress"]).toBe(true));
    it("timeout 250", () => expect(doc.jobs.drill["timeout-minutes"]).toBe(250));
    it("service image", () => expect(doc.jobs.drill.services.postgres.image).toBe("postgres:17"));
    it("PG_IMAGE", () => expect(doc.jobs.drill.env.PG_IMAGE).toBe("postgres:17"));
    for (const s of ["scripts/backup/backup.sh", "scripts/backup/restore.sh", "drill-seed.sql", "age-keygen", "14400", "GITHUB_STEP_SUMMARY"]) {
      it(`contains ${s}`, () => expect(raw).toContain(s));
    }
    const order = ["0001", "0002", "0003", "0004", "0005"];
    let last = -1;
    for (const m of order) {
      const i = raw.indexOf(m);
      expect(i).toBeGreaterThan(last);
      last = i;
    }
    it("no secrets", () => expect(raw).not.toContain("secrets."));
    it("no bad hosts", () => {
      expect(raw).not.toContain("supabase.co");
      expect(raw).not.toContain("pooler.supabase.com");
      expect(raw).not.toContain("/home/oc");
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drillSteps = doc.jobs.drill.steps as any[];
    const uploadIdx = drillSteps.findIndex((s) => s.uses === "actions/upload-artifact@v4");
    const downloadIdx = drillSteps.findIndex((s) => s.uses === "actions/download-artifact@v4");
    const timerIdx = drillSteps.findIndex((s) => String(s.name).toLowerCase().includes("timer"));
    const restoreIdx = drillSteps.findIndex((s) => String(s.run).includes("scripts/backup/restore.sh"));
    it("artifact round-trip in one job", () => {
      expect(uploadIdx).toBeGreaterThan(-1);
      expect(downloadIdx).toBeGreaterThan(uploadIdx);
    });
    it("timer before download and restore", () => {
      expect(timerIdx).toBeGreaterThan(-1);
      expect(timerIdx).toBeLessThan(downloadIdx);
      expect(restoreIdx).toBeGreaterThan(downloadIdx);
    });
    it("drill artifact retention 1", () => expect(drillSteps[uploadIdx].with["retention-days"]).toBe(1));
    it("service health", () => expect(String(doc.jobs.drill.services.postgres.options)).toContain("pg_isready"));
    it("counts/rls asserts", () => {
      expect(raw).toContain("counts_match=true");
      expect(raw).toContain("rls_probe=pass");
    });
  });

  describe("H. restore.sh", () => {
    const raw = read("scripts/backup/restore.sh");
    it("no tenant url read", () => {
      expect(raw).not.toContain("${TENANT_POSTGRES_URL");
      expect(raw).not.toContain("$TENANT_POSTGRES_URL");
    });
    it("no bad hosts", () => {
      expect(raw).not.toContain("supabase.co");
      expect(raw).not.toContain("pooler.supabase.com");
      expect(raw).not.toContain("/home/oc");
    });
  });

  describe("D. tenant tables", () => {
    const files = ["supabase/migrations/0001_tenant_schema.sql", "supabase/migrations/0005_audit_trail.sql"];
    const re = /create table if not exists public\.([a-z_]+)/g;
    const names: string[] = [];
    for (const f of files) {
      const raw = read(f);
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) names.push(m[1]);
    }
    const expected = ["workspaces", "workspace_members", "workspace_credentials", "projects", "audits", "audit_issues", "attachments", "artifacts", "artifact_summaries", "audit_trail_entries"];
    it("matches", () => expect(names.slice().sort()).toEqual(expected.slice().sort()));
  });

  describe("E. .env.example", () => {
    const raw = read(".env.example");
    it("BACKUP_POSTGRES_URL", () => expect(raw).toMatch(/^BACKUP_POSTGRES_URL=$/m));
    it("BACKUP_AGE_RECIPIENT", () => expect(raw).toMatch(/^BACKUP_AGE_RECIPIENT=$/m));
    it("CI-only", () => expect(raw).toContain("CI-only"));
  });

  describe("F. runbook", () => {
    const raw = read("docs/runbooks/restore.md");
    it("exists-ish", () => expect(raw.length).toBeGreaterThan(0));
    for (const s of ["RPO 24", "RTO 4", "PITR", "Supabase Pro", "gh run download", "age -d", "pg_restore", "0003_roles", "0004_seats_invites", "0005_audit_trail", "auditorai_app", "empty"]) {
      it(`contains ${s}`, () => expect(raw).toContain(s));
    }
    it("no bad hosts", () => {
      expect(raw).not.toContain("supabase.co");
      expect(raw).not.toContain("pooler.supabase.com");
    });
  });

  describe("G. seed sql", () => {
    const raw = read("scripts/backup/drill-seed.sql");
    it("uuid a", () => expect(raw).toContain("11111111-1111-4111-8111-111111111111"));
    it("uuid b", () => expect(raw).toContain("22222222-2222-4222-8222-222222222222"));
    const tables = ["workspaces", "workspace_members", "workspace_credentials", "projects", "audits", "audit_issues", "attachments", "artifacts", "artifact_summaries", "audit_trail_entries"];
    for (const t of tables) {
      it(`table ${t}`, () => expect(raw).toContain(t));
    }
  });
});
