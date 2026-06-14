// Elemental system — every attack carries an offensive element and every target
// has a defensive element; the chart below scales damage (classic RO triangle:
// Fire>Earth>Wind>Water>Fire, Holy<->Shadow, Neutral is even all round).

export enum Element {
  Neutral = "neutral",
  Fire = "fire",
  Water = "water",
  Wind = "wind",
  Earth = "earth",
  Holy = "holy",
  Shadow = "shadow",
}

export const ELEMENTS: Element[] = [
  Element.Neutral,
  Element.Fire,
  Element.Water,
  Element.Wind,
  Element.Earth,
  Element.Holy,
  Element.Shadow,
];

export const ELEMENT_LABEL: Record<Element, string> = {
  [Element.Neutral]: "Neutral",
  [Element.Fire]: "Fire",
  [Element.Water]: "Water",
  [Element.Wind]: "Wind",
  [Element.Earth]: "Earth",
  [Element.Holy]: "Holy",
  [Element.Shadow]: "Shadow",
};

// Representative hex tint per element, for UI accents and combat VFX.
export const ELEMENT_COLOR: Record<Element, number> = {
  [Element.Neutral]: 0xffffff,
  [Element.Fire]: 0xff6a3a,
  [Element.Water]: 0x4aa6ff,
  [Element.Wind]: 0x6cffa6,
  [Element.Earth]: 0xc79a5a,
  [Element.Holy]: 0xfff0a0,
  [Element.Shadow]: 0xb060ff,
};

export const ELEMENT_ICON: Record<Element, string> = {
  [Element.Neutral]: "⬜",
  [Element.Fire]: "🔥",
  [Element.Water]: "💧",
  [Element.Wind]: "🌪️",
  [Element.Earth]: "🪨",
  [Element.Holy]: "✨",
  [Element.Shadow]: "🌑",
};

// Damage multiplier: ELEMENT_CHART[attacker][defender]. 1 = neutral, >1 strong,
// <1 resisted. Defaults to 1 for any pair not listed.
const CHART: Partial<Record<Element, Partial<Record<Element, number>>>> = {
  [Element.Fire]: { [Element.Earth]: 1.5, [Element.Water]: 0.5, [Element.Fire]: 0.5, [Element.Shadow]: 1.25 },
  [Element.Water]: { [Element.Fire]: 1.5, [Element.Wind]: 0.5, [Element.Water]: 0.5 },
  [Element.Wind]: { [Element.Water]: 1.5, [Element.Earth]: 0.5, [Element.Wind]: 0.5 },
  [Element.Earth]: { [Element.Wind]: 1.5, [Element.Fire]: 0.5, [Element.Earth]: 0.5 },
  [Element.Holy]: { [Element.Shadow]: 1.75, [Element.Holy]: 0.25, [Element.Neutral]: 1 },
  [Element.Shadow]: { [Element.Holy]: 1.75, [Element.Shadow]: 0.25 },
};

export function elementMultiplier(attack: Element, defense: Element): number {
  return CHART[attack]?.[defense] ?? 1;
}
