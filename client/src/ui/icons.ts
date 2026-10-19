import { Element, ItemType, Weather, type ItemDef } from "@rox/shared";

// Interface glyphs: Phosphor bold (the A-Worthy system's icon set for small
// marks). No emoji in the UI. Every glyph is decorative and sits next to text,
// so it is hidden from assistive tech.

export function ph(name: string, extraClass = ""): string {
  return `<i class="ph-bold ph-${name}${extraClass ? " " + extraClass : ""}" aria-hidden="true"></i>`;
}

// Build an icon + text into an element without going through innerHTML, for
// labels that include player-chosen names.
export function setIconText(el: HTMLElement, icon: string, text: string): void {
  el.textContent = "";
  const i = document.createElement("i");
  i.className = `ph-bold ph-${icon}`;
  i.setAttribute("aria-hidden", "true");
  el.append(i, " ", text);
}

// One icon per item category (shared by the bag, Kafra storage and guild vault).
export function itemIcon(item: ItemDef): string {
  if (item.pet) return "egg";
  if (item.mount) return "horse";
  if (item.costume) return "t-shirt";
  if (item.type === ItemType.Card) return "cards";
  if (item.type === ItemType.Material) return "cube";
  if (item.type === ItemType.Consumable) return item.food ? "fork-knife" : item.healSp ? "drop" : "flask";
  if (item.type === ItemType.Weapon) return item.matk ? "magic-wand" : "sword";
  if (item.type === ItemType.Headgear) return "crown-simple";
  if (item.type === ItemType.Armor) return "shield";
  return "diamond"; // accessory
}

export const WEATHER_ICON_PH: Record<Weather, string> = {
  [Weather.Clear]: "sun",
  [Weather.Rain]: "cloud-rain",
  [Weather.Fog]: "cloud-fog",
  [Weather.Storm]: "cloud-lightning",
  [Weather.Snow]: "snowflake",
};

export const ELEMENT_ICON_PH: Record<Element, string> = {
  [Element.Neutral]: "circle",
  [Element.Fire]: "fire",
  [Element.Water]: "drop",
  [Element.Wind]: "wind",
  [Element.Earth]: "mountains",
  [Element.Holy]: "sparkle",
  [Element.Shadow]: "moon",
};
