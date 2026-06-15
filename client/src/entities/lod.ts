// Distance-based level-of-detail for entity views. Pure (no three import) so the
// thresholds are unit-testable. Distances are camera→entity, in world units;
// the map is 120 units across with fog from ~66 to ~150.

export const LOD_LABEL_SQ = 60 * 60; // hide the nameplate/HP label beyond this
export const LOD_FREEZE_SQ = 90 * 90; // stop animating (freeze pose / pause mixer)
export const LOD_CULL_SQ = 140 * 140; // skip rendering entirely (≈ fully fogged)

export type LodTier = "full" | "frozen" | "culled";

// full   — visible + animated
// frozen — visible, animation paused (saves CPU on the mixer + procedural anim)
// culled — not rendered at all
export function lodTier(distSq: number): LodTier {
  if (distSq > LOD_CULL_SQ) return "culled";
  if (distSq > LOD_FREEZE_SQ) return "frozen";
  return "full";
}

export function labelVisible(distSq: number): boolean {
  return distSq < LOD_LABEL_SQ;
}
