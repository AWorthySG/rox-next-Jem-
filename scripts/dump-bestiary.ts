// Generates docs/BESTIARY.md from the live game data (monster templates + map
// spawns), so the bestiary never drifts from the source of truth.
//   npm run bestiary
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MONSTER_TEMPLATES, MAPS } from "@rox/engine";
import { ELEMENT_LABEL, Element, type MonsterTemplate, type BossMechanic } from "@rox/shared";

// templateId -> the maps it spawns on (display names)
const mapsByTemplate = new Map<string, Set<string>>();
for (const m of Object.values(MAPS)) {
  for (const z of m.zones) {
    let s = mapsByTemplate.get(z.templateId);
    if (!s) mapsByTemplate.set(z.templateId, (s = new Set()));
    s.add(m.name);
  }
}

function mechStr(mech: BossMechanic): string {
  switch (mech.kind) {
    case "enrage":
      return `Enrage ≤${Math.round(mech.hpPct * 100)}% (×${mech.atkMult} ATK)`;
    case "nova":
      return `Nova (radius ${mech.radius})`;
    case "summon":
      return `Summon ${MONSTER_TEMPLATES[mech.templateId]?.name ?? mech.templateId}`;
    case "heal":
      return `Heal ${Math.round(mech.pct * 100)}%/cast`;
  }
}

const el = (t: MonsterTemplate) => ELEMENT_LABEL[t.element ?? Element.Neutral];
const where = (t: MonsterTemplate) => [...(mapsByTemplate.get(t.id) ?? [])].join(", ") || "—";
const byLevel = (a: MonsterTemplate, b: MonsterTemplate) => a.level - b.level || a.name.localeCompare(b.name);

const all = Object.values(MONSTER_TEMPLATES).sort(byLevel);
const regulars = all.filter((t) => !t.boss);
const bosses = all.filter((t) => t.boss);
const worldBosses = bosses.filter((t) => t.worldBoss);
const mvps = bosses.filter((t) => !t.worldBoss);

const lines: string[] = [];
lines.push("# ROX-Next — Bestiary");
lines.push("");
lines.push("_Auto-generated from the game data via `npm run bestiary`. Do not edit by hand._");
lines.push("");
lines.push(
  `**${all.length}** total creatures — **${regulars.length}** regular monsters, ` +
    `**${mvps.length}** MVP bosses, and **${worldBosses.length}** shared-HP world bosses, ` +
    `spawning across **${Object.keys(MAPS).length}** maps.`,
);
lines.push("");

lines.push("## 🐉 World Bosses (shared HP raids)");
lines.push("");
lines.push("| Boss | Lv | HP | EXP | Element | Mechanics | Found In |");
lines.push("|------|----|----|-----|---------|-----------|----------|");
for (const t of worldBosses.sort(byLevel)) {
  const mech = (t.mechanics ?? []).map(mechStr).join("; ") || "—";
  lines.push(`| **${t.name}** | ${t.level} | ${t.baseHp.toLocaleString()} | ${t.baseExp.toLocaleString()} | ${el(t)} | ${mech} | ${where(t)} |`);
}
lines.push("");

lines.push("## ⚔️ MVP Bosses");
lines.push("");
lines.push("| Boss | Lv | HP | EXP | Element | Mechanics | Found In |");
lines.push("|------|----|----|-----|---------|-----------|----------|");
for (const t of mvps.sort(byLevel)) {
  const mech = (t.mechanics ?? []).map(mechStr).join("; ") || "—";
  lines.push(`| **${t.name}** | ${t.level} | ${t.baseHp.toLocaleString()} | ${t.baseExp.toLocaleString()} | ${el(t)} | ${mech} | ${where(t)} |`);
}
lines.push("");

lines.push("## 👹 Regular Monsters");
lines.push("");
lines.push("| Monster | Lv | HP | EXP | Element | Found In |");
lines.push("|---------|----|----|-----|---------|----------|");
for (const t of regulars) {
  lines.push(`| ${t.name} | ${t.level} | ${t.baseHp.toLocaleString()} | ${t.baseExp.toLocaleString()} | ${el(t)} | ${where(t)} |`);
}
lines.push("");

const root = fileURLToPath(new URL("..", import.meta.url));
mkdirSync(`${root}docs`, { recursive: true });
const out = `${root}docs/BESTIARY.md`;
writeFileSync(out, lines.join("\n"));
console.log(`Wrote ${out} — ${all.length} creatures (${regulars.length} regular, ${mvps.length} MVP, ${worldBosses.length} world boss).`);
