import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";
import {
  CANDIDATE_OUTCOMES_DIR,
  outcomeTripwireSink,
  setCandidateOutcomeSinkForTests,
} from "@/domain/outcomes";

/**
 * Global test isolation for CandidateOutcome logging (ADR-0009): no test may
 * write to the real state/candidate-outcomes/ sink. A throwing memory sink
 * doubles as a tripwire — any suite that expects rows must inject its own
 * recording sink explicitly.
 */
beforeAll(() => {
  setCandidateOutcomeSinkForTests(outcomeTripwireSink());
});

afterAll(() => {
  // Warn-only leak tripwire (safest posture): the real dir is shared with
  // parallel sessions and real auditor work products, so NOTHING here is ever
  // deleted — leaks are named loudly instead, and the beforeAll tripwire keeps
  // them from happening in the first place.
  const dir = path.join(process.cwd(), CANDIDATE_OUTCOMES_DIR);
  try {
    if (!existsSync(dir)) return;
    const leaked = readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f));
    if (leaked.length)
      console.warn(
        `[test-isolation] LEAKED outcome files remain under ${dir} (left untouched): ${leaked.join(", ")}`,
      );
  } catch {
    /* best effort */
  }
});
