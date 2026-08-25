// D03-MATCH — assign jurisdiction/framework/native stage via the existing deep
// modules (getPack + resolveOdd). No ODD logic is duplicated here: cell status,
// three-zone discipline and structurally-absent refusal all come from
// src/domain/odd.ts. Stage inference is a deterministic keyword pass over pack
// stage vocabulary (display_name + definition + trigger).
import { getPack } from "@/domain/packs";
import { resolveOdd } from "@/domain/odd";
import type { CanonicalStage } from "@/domain/types";
import { matchId } from "@/discovery/ids";
import type { MatchAssignment, Qualification } from "@/discovery/types";


export interface MatchOutcome {
  assignment: MatchAssignment | null;
  refusal_reason: string | null;
}

export function matchQualified(q: Qualification): MatchOutcome {
  const jur = q.jurisdiction_guess;
  if (!jur || !q.scheme_hint) {
    return { assignment: null, refusal_reason: "no jurisdiction/stage signal to match against" };
  }
  const pack = getPack(jur);
  const text = q.scheme_hint.toLowerCase();

  // Deterministic keyword scoring over native stage vocabulary.
  const normalized = text.replace(/[-_]+/g, " ");
  const numMatch = /\bstage\s*(\d+)\b/.exec(normalized);
  // Numeric stage hints are only decisive in packs that actually number their
  // stages (UK/CA/AE do; US names phases; INT baseline is descriptive).
  const stageHay = (stageText: string): string => {
    const st = pack.stages.find((x) => x.native_stage_id === stageText)!;
    return [st.display_name, st.definition, st.trigger ?? "", st.native_stage_id.replace(/[:_-]+/g, " ")].join(" ").toLowerCase();
  };
  const packUsesNumberedStages =
    numMatch !== null &&
    pack.stages.some((st) => /stage\s*\d+\b/.test(stageHay(st.native_stage_id)));
  let bestStageId: string | null = null;
  let bestScore = 0;
  for (const stage of pack.stages) {
    let score = 0;
    const hay = [
      stage.display_name,
      stage.definition,
      stage.trigger ?? "",
      stage.native_stage_id.replace(/[:_-]+/g, " "),
    ]
      .join(" ")
      .toLowerCase();
    for (const token of tokenize(normalized)) {
      if (token.length < 4) continue;
      if (hay.includes(token)) score += 1;
    }
    // Explicit "Stage N" in the hint: decisive only in numbered-stage packs.
    // Stages carrying a different number are disqualified outright (a Stage 2
    // definition mentioning Stage 1 reviews must never win a Stage 1 hint).
    if (numMatch && packUsesNumberedStages) {
      const declaresN = new RegExp(`stage\\s*${numMatch[1]}\\b`).test(hay);
      const declaresOther = /stage\s*\d+\b/.test(hay.replace(new RegExp(`stage\\s*${numMatch[1]}\\b`, "g"), ""));
      if (!declaresN || declaresOther) continue;
      score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStageId = stage.native_stage_id;
    }
  }
  if (!bestStageId || bestScore < 2) {
    return { assignment: null, refusal_reason: `no ${jur} stage matched scheme hint (score ${bestScore})` };
  }

  const stage = pack.stages.find((s) => s.native_stage_id === bestStageId)!;
  const canonical = stage.canonical_stages as CanonicalStage[];
  if (canonical.length === 0) {
    return { assignment: null, refusal_reason: `stage ${bestStageId} maps to no canonical stage (out of MVP scope)` };
  }

  const odd = resolveOdd(jur, canonical);
  if (odd.status === "structurally_absent" || odd.status === "unlisted") {
    return { assignment: null, refusal_reason: `selection is outside the ODD (${odd.status}); refused` };
  }

  return {
    assignment: {
      match_id: matchId(q.qualification_id),
      qualification_id: q.qualification_id,
      jurisdiction: jur,
      native_stage_id: bestStageId,
      canonical_stages: canonical,
      mapping_confidence: stage.confidence,
      odd_status: odd.status,
      matched_by: `keyword:${bestScore}`,
    },
    refusal_reason: null,
  };
}

function tokenize(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}
