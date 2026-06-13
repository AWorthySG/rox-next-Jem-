export interface QuestReward {
  exp: number;
  zeny: number;
  items?: Array<{ id: string; qty: number }>;
}

export interface Quest {
  id: string;
  name: string;
  desc: string;
  targetTemplate: string; // monster template id to slay
  targetName: string; // display name of the target
  count: number;
  requiredLevel: number;
  reward: QuestReward;
}

// Kill-quest board offered by the town Guide. Ordered by difficulty.
export const QUESTS: Record<string, Quest> = {
  poring_purge: {
    id: "poring_purge",
    name: "Poring Purge",
    desc: "The fields are overrun. Thin the Poring population.",
    targetTemplate: "poring",
    targetName: "Poring",
    count: 10,
    requiredLevel: 1,
    reward: { exp: 120, zeny: 80, items: [{ id: "red_potion", qty: 3 }] },
  },
  fabre_fears: {
    id: "fabre_fears",
    name: "Fabre Fears",
    desc: "Fabres are nibbling the crops. Deal with them.",
    targetTemplate: "fabre",
    targetName: "Fabre",
    count: 8,
    requiredLevel: 3,
    reward: { exp: 220, zeny: 140, items: [{ id: "cotton_shirt", qty: 1 }] },
  },
  drop_the_drops: {
    id: "drop_the_drops",
    name: "Drop the Drops",
    desc: "Sweet Drops draw too many adventurers. Clear them out.",
    targetTemplate: "drops",
    targetName: "Drops",
    count: 8,
    requiredLevel: 5,
    reward: { exp: 360, zeny: 220, items: [{ id: "blue_potion", qty: 3 }] },
  },
  lunatic_hunt: {
    id: "lunatic_hunt",
    name: "Lunatic Hunt",
    desc: "Lunatics grow bold near the meadow. Hunt them down.",
    targetTemplate: "lunatic",
    targetName: "Lunatic",
    count: 6,
    requiredLevel: 8,
    reward: { exp: 600, zeny: 360, items: [{ id: "leather_armor", qty: 1 }] },
  },
  slay_the_king: {
    id: "slay_the_king",
    name: "Slay the King",
    desc: "The Poring King rules the northern arena. End its reign.",
    targetTemplate: "poring_king",
    targetName: "Poring King",
    count: 1,
    requiredLevel: 12,
    reward: { exp: 2500, zeny: 1500, items: [{ id: "ring_of_power", qty: 1 }] },
  },
};

export function getQuest(id: string): Quest | undefined {
  return QUESTS[id];
}

export interface ActiveQuest {
  id: string;
  progress: number;
}

export interface QuestState {
  active: ActiveQuest[];
  completed: string[];
}
