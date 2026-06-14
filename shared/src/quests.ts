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
  repeatable?: boolean; // daily-style bounty: re-acceptable after turning in
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
  fabre_cull: {
    id: "fabre_cull",
    name: "Fabre Cull",
    desc: "More Fabres have hatched. Cull the swarm.",
    targetTemplate: "fabre",
    targetName: "Fabre",
    count: 12,
    requiredLevel: 2,
    reward: { exp: 280, zeny: 160, items: [{ id: "novice_knife", qty: 1 }] },
  },
  lunatic_purge: {
    id: "lunatic_purge",
    name: "Lunatic Purge",
    desc: "The meadow Lunatics breed too fast. Thin them out.",
    targetTemplate: "lunatic",
    targetName: "Lunatic",
    count: 12,
    requiredLevel: 6,
    reward: { exp: 800, zeny: 420, items: [{ id: "ring_of_power", qty: 1 }] },
  },
  zombie_cleanup: {
    id: "zombie_cleanup",
    name: "Zombie Cleanup",
    desc: "The undead shamble through Glast Heim. Put them to rest.",
    targetTemplate: "zombie",
    targetName: "Zombie",
    count: 12,
    requiredLevel: 15,
    reward: { exp: 3200, zeny: 1800, items: [{ id: "saint_robe", qty: 1 }] },
  },
  bone_collector: {
    id: "bone_collector",
    name: "Bone Collector",
    desc: "Skeletons guard the inner halls. Scatter their bones.",
    targetTemplate: "skeleton",
    targetName: "Skeleton",
    count: 12,
    requiredLevel: 18,
    reward: { exp: 4800, zeny: 2600, items: [{ id: "claymore", qty: 1 }] },
  },
  demon_slayer: {
    id: "demon_slayer",
    name: "Demon Slayer",
    desc: "Baphomet rules Glast Heim's depths. Banish the demon lord.",
    targetTemplate: "baphomet",
    targetName: "Baphomet",
    count: 1,
    requiredLevel: 28,
    reward: { exp: 15000, zeny: 9000, items: [{ id: "baphomet_horn", qty: 1 }] },
  },
  beach_patrol: {
    id: "beach_patrol",
    name: "Beach Patrol",
    desc: "Sandmen ambush travelers on Comodo's shore. Clear them.",
    targetTemplate: "sandman",
    targetName: "Sandman",
    count: 12,
    requiredLevel: 50,
    reward: { exp: 24000, zeny: 12000, items: [{ id: "tidal_shoes", qty: 1 }] },
  },
  jungle_rite: {
    id: "jungle_rite",
    name: "Jungle Rite",
    desc: "The Umbala Dryads stir. Calm the forest.",
    targetTemplate: "dryad",
    targetName: "Dryad",
    count: 12,
    requiredLevel: 62,
    reward: { exp: 40000, zeny: 20000, items: [{ id: "spirit_staff", qty: 1 }] },
  },
  iron_works: {
    id: "iron_works",
    name: "Iron Works",
    desc: "Einbroch's Metalings clog the factory. Scrap them.",
    targetTemplate: "metaling",
    targetName: "Metaling",
    count: 14,
    requiredLevel: 80,
    reward: { exp: 90000, zeny: 45000, items: [{ id: "dragon_slayer", qty: 1 }] },
  },
  end_of_memory: {
    id: "end_of_memory",
    name: "End of Memory",
    desc: "Atop Thanatos Tower waits the Memory of Thanatos. End it.",
    targetTemplate: "memory_of_thanatos",
    targetName: "Memory of Thanatos",
    count: 1,
    requiredLevel: 120,
    reward: { exp: 800000, zeny: 300000, items: [{ id: "fallen_angel_wing", qty: 1 }] },
  },
  desert_curse: {
    id: "desert_curse",
    name: "Curse of the Sands",
    desc: "Anubis stalk the Morocc dunes. Lay the jackals to rest.",
    targetTemplate: "anubis",
    targetName: "Anubis",
    count: 14,
    requiredLevel: 116,
    reward: { exp: 700000, zeny: 280000, items: [{ id: "desert_sabre", qty: 1 }] },
  },
  satan_slayer: {
    id: "satan_slayer",
    name: "Fall of Morocc",
    desc: "The demon Satan Morroc rules the desert. Banish it.",
    targetTemplate: "satan_morroc",
    targetName: "Satan Morroc",
    count: 1,
    requiredLevel: 124,
    reward: { exp: 1200000, zeny: 500000, items: [{ id: "morrigane_helm", qty: 1 }] },
  },
  bio_breach: {
    id: "bio_breach",
    name: "Containment Breach",
    desc: "The Bio Lab's experiments are loose. Purge the Wickebines.",
    targetTemplate: "wickebine",
    targetName: "Wickebine",
    count: 14,
    requiredLevel: 122,
    reward: { exp: 900000, zeny: 360000, items: [{ id: "bio_coat", qty: 1 }] },
  },
  abyssal_dive: {
    id: "abyssal_dive",
    name: "Into the Abyss",
    desc: "Ferus dragons nest at Abyss Lake. Thin the brood.",
    targetTemplate: "ferus",
    targetName: "Ferus",
    count: 14,
    requiredLevel: 126,
    reward: { exp: 1100000, zeny: 440000, items: [{ id: "dragon_scale_mail", qty: 1 }] },
  },
  world_serpent: {
    id: "world_serpent",
    name: "The World Serpent",
    desc: "Nidhoggr's Shadow coils at the bottom of the Abyss. End it all.",
    targetTemplate: "nidhoggr",
    targetName: "Nidhoggr's Shadow",
    count: 1,
    requiredLevel: 130,
    reward: { exp: 2000000, zeny: 800000, items: [{ id: "nidhoggr_eye", qty: 1 }] },
  },

  // ---- repeatable daily bounties (turn in and re-accept for steady income) ----
  bounty_porings: {
    id: "bounty_porings",
    name: "Daily Bounty: Porings",
    desc: "A standing order: clear Porings for the merchant guild.",
    targetTemplate: "poring",
    targetName: "Poring",
    count: 15,
    requiredLevel: 1,
    reward: { exp: 200, zeny: 300, items: [{ id: "red_potion", qty: 2 }] },
    repeatable: true,
  },
  bounty_skeletons: {
    id: "bounty_skeletons",
    name: "Daily Bounty: Skeletons",
    desc: "A standing order: scatter Glast Heim's skeletons.",
    targetTemplate: "skeleton",
    targetName: "Skeleton",
    count: 15,
    requiredLevel: 18,
    reward: { exp: 5000, zeny: 3000, items: [{ id: "blue_potion", qty: 3 }] },
    repeatable: true,
  },
  bounty_metalings: {
    id: "bounty_metalings",
    name: "Daily Bounty: Metalings",
    desc: "A standing order: recycle Einbroch's Metalings.",
    targetTemplate: "metaling",
    targetName: "Metaling",
    count: 15,
    requiredLevel: 80,
    reward: { exp: 110000, zeny: 60000, items: [{ id: "royal_feast", qty: 1 }] },
    repeatable: true,
  },
  bounty_anubis: {
    id: "bounty_anubis",
    name: "Daily Bounty: Ore Run",
    desc: "A standing order: hunt Anubis for refine ore.",
    targetTemplate: "anubis",
    targetName: "Anubis",
    count: 15,
    requiredLevel: 116,
    reward: { exp: 600000, zeny: 200000, items: [{ id: "oridecon", qty: 3 }, { id: "elunium", qty: 3 }] },
    repeatable: true,
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
