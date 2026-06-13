export type AchievementKind = "level" | "kills" | "boss";

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  kind: AchievementKind;
  value: number | string; // level/kills threshold, or boss templateId
  rewardZeny: number;
}

// Milestone achievements, evaluated server-side as the player progresses.
export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  first_blood: { id: "first_blood", name: "First Blood", desc: "Defeat your first monster.", kind: "kills", value: 1, rewardZeny: 50 },
  monster_hunter: { id: "monster_hunter", name: "Monster Hunter", desc: "Defeat 100 monsters.", kind: "kills", value: 100, rewardZeny: 1500 },
  exterminator: { id: "exterminator", name: "Exterminator", desc: "Defeat 1000 monsters.", kind: "kills", value: 1000, rewardZeny: 15000 },
  veteran: { id: "veteran", name: "Veteran", desc: "Reach level 25.", kind: "level", value: 25, rewardZeny: 500 },
  elite: { id: "elite", name: "Elite", desc: "Reach level 50.", kind: "level", value: 50, rewardZeny: 3000 },
  legend: { id: "legend", name: "Legend", desc: "Reach level 100.", kind: "level", value: 100, rewardZeny: 20000 },
  maxed: { id: "maxed", name: "Maxed Out", desc: "Reach the level cap of 130.", kind: "level", value: 130, rewardZeny: 100000 },
  regicide: { id: "regicide", name: "Regicide", desc: "Slay the Poring King.", kind: "boss", value: "poring_king", rewardZeny: 1000 },
  demon_bane: { id: "demon_bane", name: "Demon Bane", desc: "Slay Baphomet.", kind: "boss", value: "baphomet", rewardZeny: 6000 },
  lord_of_lords: { id: "lord_of_lords", name: "Lord of Lords", desc: "Slay Beelzebub.", kind: "boss", value: "beelzebub", rewardZeny: 80000 },
};

export function allAchievements(): AchievementDef[] {
  return Object.values(ACHIEVEMENTS);
}
