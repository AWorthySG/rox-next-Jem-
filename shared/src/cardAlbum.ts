import { ITEMS } from "./items.js";
import { ItemType } from "./enums.js";

// The Card Album — a collection index over every card in the game. A card is
// registered to a player's album the first time they own it; the more distinct
// cards registered, the larger a passive "collector's" bonus, with an extra
// reward for completing the set. This rewards hunting cards beyond the raw
// socket bonus a single card gives.
export const CARD_IDS: string[] = Object.values(ITEMS)
  .filter((i) => i.type === ItemType.Card)
  .map((i) => i.id)
  .sort();

export const CARD_ALBUM_TOTAL = CARD_IDS.length;
export const CARD_ALBUM_HP_PER = 8; // +max HP per distinct card registered
export const CARD_ALBUM_SP_PER = 3; // +max SP per distinct card registered
// Completing the whole album grants an extra flat bonus on top of the per-card one.
export const CARD_ALBUM_COMPLETE_HP = 200;
export const CARD_ALBUM_COMPLETE_SP = 80;

export function isCardComplete(registeredCount: number): boolean {
  return CARD_ALBUM_TOTAL > 0 && registeredCount >= CARD_ALBUM_TOTAL;
}
