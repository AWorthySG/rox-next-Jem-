import { Element, elementMultiplier } from "./elements.js";
import { DamageKind } from "./enums.js";
import type { DerivedStats } from "./stats.js";

export interface DamageResult {
  amount: number;
  crit: boolean;
  miss: boolean;
  kind: DamageKind;
  elementMult?: number; // applied elemental modifier (1 = neutral)
}

export interface ElementPair {
  attack: Element;
  defense: Element;
}

// Pure damage resolution. `rng` defaults to Math.random so the server stays the
// source of truth; callers can inject a seeded rng for tests. When `elements`
// is supplied, the elemental chart scales the final damage.
export function resolveAttack(
  attacker: DerivedStats,
  defender: DerivedStats,
  kind: DamageKind,
  rng: () => number = Math.random,
  powerMult = 1,
  elements?: ElementPair,
): DamageResult {
  // Hit chance: 80% baseline, shifted by accuracy vs evasion, clamped 5%..100%.
  const hitChance = clamp(0.8 + (attacker.hit - defender.flee) * 0.02, 0.05, 1);
  if (kind === DamageKind.Physical && rng() > hitChance) {
    return { amount: 0, crit: false, miss: true, kind };
  }

  const base = kind === DamageKind.Magic ? attacker.matk : attacker.atk;
  // ±15% variance on the raw attack power, scaled by the skill multiplier.
  const rolled = base * powerMult * (0.85 + rng() * 0.3);

  // Magic partially ignores physical DEF.
  const mitigation = kind === DamageKind.Magic ? defender.def * 0.4 : defender.def;

  const crit = rng() * 100 < attacker.crit;
  let amount = Math.max(1, Math.round(rolled - mitigation));
  if (crit) amount = Math.round(amount * 1.5);

  const elementMult = elements ? elementMultiplier(elements.attack, elements.defense) : 1;
  if (elementMult !== 1) amount = Math.max(1, Math.round(amount * elementMult));

  return { amount, crit, miss: false, kind, elementMult };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
