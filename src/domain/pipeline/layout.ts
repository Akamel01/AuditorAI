// Longest-path layering of pipeline descriptors for Candidate-A-style vertical
// rendering. Pure derivation over the registry vocabulary — safe to import
// from both the server session store and the dev-console client.
import type { AgNodeId, NodeDescriptor } from "@/domain/pipeline/types";

export function buildLayers(descriptors: NodeDescriptor[]): NodeDescriptor[][] {
  const depth = new Map<string, number>();
  const byId = new Map(descriptors.map((d) => [d.id, d]));
  const resolve = (id: AgNodeId): number => {
    if (depth.has(id)) return depth.get(id)!;
    const d = byId.get(id);
    const val =
      !d || d.depends_on.length === 0
        ? 0
        : Math.max(...d.depends_on.map((dep) => resolve(dep) + 1));
    depth.set(id, val);
    return val;
  };
  descriptors.forEach((d) => resolve(d.id));

  const layers: NodeDescriptor[][] = [];
  for (const d of descriptors) {
    const idx = depth.get(d.id) ?? 0;
    (layers[idx] ||= []).push(d);
  }
  return layers.filter(Boolean);
}
