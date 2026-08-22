// AG-QUESTIONS — Audit Question Selection (deterministic). Surfaces pack
// questions whose canonical span intersects the resolved stage; text quoted
// verbatim; every question starts unaddressed.
import { getPack } from "@/domain/packs";
import { makeArtifact, requireSlice } from "@/domain/pipeline/nodes/shared";
import type {
  NodeFn,
  QuestionsSlice,
  StageContextSlice,
} from "@/domain/pipeline/types";

export const runQuestions: NodeFn = (state, ctx) => {
  const sc = requireSlice("AG-QUESTIONS", state, "stage_context") as StageContextSlice;
  const pack = getPack(sc.jurisdiction);

  const slice: QuestionsSlice = pack.audit_questions
    .filter((q) => q.applies_to_canonical.some((c) => sc.canonical_stages.includes(c as never)))
    .map((q) => ({
      question_id: q.question_id,
      text: q.text,
      topic: q.topic,
      applies_to_canonical:
        q.applies_to_canonical as QuestionsSlice[number]["applies_to_canonical"],
      road_users: q.road_users ?? [],
      source_note: q.source_note ?? null,
      addressed: false,
    }));

  return {
    artifacts: [
      makeArtifact("AG-QUESTIONS", "domain-engine", "questions.set", 1, ctx, "verified", slice),
    ],
    patch: { audit_questions: slice },
  };
};
