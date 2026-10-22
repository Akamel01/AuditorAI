// The operator-only KV -> Postgres migration CLI (ticket #53, module M5).
//
// Usage:
//   npx tsx scripts/migrate-kv-to-postgres.ts                     # dry run (default)
//   npx tsx scripts/migrate-kv-to-postgres.ts --apply \
//     --target-label ca-central-1-postgres \
//     --confirm-target ca-central-1-postgres
//   npx tsx scripts/migrate-kv-to-postgres.ts --apply --force ...  # target already holds rows
//   npx tsx scripts/migrate-kv-to-postgres.ts --json              # machine-readable report
//
// Policy (operator-invoked only — this script is NOT wired into any npm
// script or CI job, and an agent must never run it against a live project):
//   * the default is a DRY RUN: the source is enumerated and reported, nothing
//     is written;
//   * --apply additionally requires --confirm-target whose value equals
//     --target-label;
//   * --force is required to write into a target that already holds tenant
//     rows;
//   * the KV source is READ-ONLY. The migration only enumerates and reads it;
//     the KV copy stays the rollback path (a workspace goes back to KV by
//     removing its credential row from public.workspace_credentials);
//   * the per-workspace transaction backfills public.workspace_credentials —
//     without that row the migrated data is unreachable by any credential.
import { closePgPool, createPgSqlClient } from "@/lib/db/pg-client";
import { migrateKvToPostgres, type MigrationReport } from "@/lib/db/migration";
import type { SqlClient } from "@/lib/db/sql";
import { KvRestStore } from "@/lib/persistence/store";

const DEFAULT_TARGET_LABEL = "ca-central-1-postgres";

interface Options {
  apply: boolean;
  confirmTarget: string | null;
  targetLabel: string;
  force: boolean;
  json: boolean;
  help: boolean;
}

function usage(): string {
  return [
    "Usage: npx tsx scripts/migrate-kv-to-postgres.ts [options]",
    "",
    "  (no options)        dry run: enumerate + report, write nothing   <-- DEFAULT",
    "  --apply             perform writes (still needs --confirm-target)",
    "  --confirm-target L  REQUIRED for --apply; L must equal --target-label",
    `  --target-label L    the label the operator expects (default "${DEFAULT_TARGET_LABEL}")`,
    "  --force             allow writing into a target that already holds tenant rows",
    "  --json              machine-readable report on stdout",
    "  --help              this text",
    "",
    "Environment: KV_REST_API_URL + KV_REST_API_TOKEN (the KV source),",
    "POSTGRES_URL (the target, the auditorai_app role).",
  ].join("\n");
}

function fail(message: string, code = 1): never {
  console.error(`error: ${message}`);
  process.exit(code);
}

function usageError(message: string): never {
  console.error(`error: ${message}\n`);
  console.error(usage());
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    confirmTarget: null,
    targetLabel: DEFAULT_TARGET_LABEL,
    force: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? null : arg.slice(eq + 1);
    const takeValue = (): string => {
      if (inline !== null) return inline;
      const next = argv[i + 1];
      if (next === undefined) usageError(`missing value for ${name}`);
      i += 1;
      return next;
    };
    switch (name) {
      case "--apply":
        options.apply = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--confirm-target":
        options.confirmTarget = takeValue();
        break;
      case "--target-label":
        options.targetLabel = takeValue();
        break;
      default:
        usageError(`unknown option ${arg}`);
    }
  }
  return options;
}

function printReport(report: MigrationReport, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const pad = (label: string): string => label.padEnd(26);
  console.log("KV -> Postgres migration report");
  console.log(`  ${pad("mode")}${report.dryRun ? "DRY RUN (nothing written)" : "APPLY"}`);
  console.log(`  ${pad("keys seen")}${report.keysSeen}`);
  console.log(`  ${pad("keys skipped")}${report.keysSkipped}`);
  for (const [reason, count] of Object.entries(report.skippedByReason)) {
    console.log(`    ${reason.padEnd(40)}${count}`);
  }
  console.log(`  ${pad("workspaces planned")}${report.workspacesPlanned}`);
  console.log(`  ${pad("workspaces migrated")}${report.workspacesMigrated}`);
  console.log(`  ${pad("rows planned")}${report.rowsPlanned}`);
  console.log(`  ${pad("rows inserted")}${report.rowsInserted}`);
  console.log(`  ${pad("rows skipped")}${report.rowsSkipped}`);
  console.log(`  ${pad("target rows found")}${report.targetRowsFound}`);
  console.log(`  ${pad("conflicts")}${report.conflicts.length}`);
  for (const conflict of report.conflicts) {
    console.log(`    ${conflict.key}: ${conflict.detail}`);
  }
  console.log(`  ${pad("credentials planned")}${report.credentialsPlanned}`);
  console.log(`  ${pad("credentials backfilled")}${report.credentialsBackfilled}`);
  console.log("  rows by table");
  for (const [table, count] of Object.entries(report.rowsByTable)) {
    console.log(`    ${table.padEnd(40)}${count}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.apply && (!options.confirmTarget || options.confirmTarget !== options.targetLabel)) {
    fail(
      `--apply requires --confirm-target ${options.targetLabel} (the value must equal --target-label)`,
      2,
    );
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    fail("the KV source is not configured (KV_REST_API_URL / KV_REST_API_TOKEN)");
  }
  // KvRestStore directly, NOT getDataStore(): the app's store falls back to
  // memory when KV is unreachable, and a migration that silently migrates an
  // empty store is worse than one that fails.
  const source = new KvRestStore(kvUrl, kvToken);

  let target: SqlClient | null = null;
  if (process.env.POSTGRES_URL) {
    target = createPgSqlClient();
  } else if (options.apply) {
    fail("POSTGRES_URL is not set: the target store is not configured");
  }

  try {
    // Dry run first: it reports the plan and the target's occupancy, and it
    // writes nothing. The apply run then refuses a non-empty target without
    // --force.
    let plan: MigrationReport;
    try {
      plan = await migrateKvToPostgres({ source, target, apply: false, force: options.force });
    } catch (error) {
      if (!target) throw error;
      console.error(
        `warning: target inspection failed (${error instanceof Error ? error.message : String(error)}) — the plan below is source-only`,
      );
      plan = await migrateKvToPostgres({ source, target: null, apply: false, force: options.force });
    }

    if (!options.apply) {
      printReport(plan, options.json);
      return;
    }

    if (plan.targetRowsFound > 0 && !options.force) {
      printReport(plan, options.json);
       fail(
         `the target already holds ${plan.targetRowsFound} row(s) for the workspace(s) being migrated; re-run with --force to write into it (the core's per-workspace backstop at src/lib/db/migration.ts:503-509)`,
       );
    }

    const report = await migrateKvToPostgres({
      source,
      target,
      apply: true,
      force: options.force,
    });
    printReport(report, options.json);
  } finally {
    await closePgPool();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
