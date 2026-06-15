// Generates docs/MODEL_CHECKLIST.md + docs/model_checklist.csv: the full list of
// monster/boss templates that need a mid-poly .glb, with the target filename
// (the <templateId>.glb the loader auto-resolves), display name, visual family,
// tier, level, element, a suggested poly budget, and where it spawns.
//   npm run checklist
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MONSTER_TEMPLATES, MAPS } from "@rox/engine";
import { ELEMENT_LABEL, Element, type MonsterTemplate } from "@rox/shared";
import { ARCH } from "../client/src/procedural/monsters.js";

const mapsByTemplate = new Map<string, Set<string>>();
for (const m of Object.values(MAPS)) {
  for (const z of m.zones) {
    let s = mapsByTemplate.get(z.templateId);
    if (!s) mapsByTemplate.set(z.templateId, (s = new Set()));
    s.add(m.name);
  }
}

const tier = (t: MonsterTemplate) => (t.worldBoss ? "World Boss" : t.boss ? "MVP Boss" : "Regular");
const budget = (t: MonsterTemplate) => (t.worldBoss ? "10k–15k" : t.boss ? "6k–10k" : "1.5k–5k");
const family = (t: MonsterTemplate) => ARCH[t.id] ?? "jelly";
const el = (t: MonsterTemplate) => ELEMENT_LABEL[t.element ?? Element.Neutral];
const where = (t: MonsterTemplate) => [...(mapsByTemplate.get(t.id) ?? [])].join(", ") || "—";

const all = Object.values(MONSTER_TEMPLATES).sort(
  (a, b) => Number(a.boss ?? false) - Number(b.boss ?? false) || a.level - b.level || a.name.localeCompare(b.name),
);

const regulars = all.filter((t) => !t.boss).length;
const mvps = all.filter((t) => t.boss && !t.worldBoss).length;
const world = all.filter((t) => t.worldBoss).length;

const md: string[] = [];
md.push("# ROX-Next — Model Production Checklist");
md.push("");
md.push("_Auto-generated via `npm run checklist`. Do not edit by hand._");
md.push("");
md.push(
  `**${all.length}** models to produce — **${regulars}** regular, **${mvps}** MVP bosses, ` +
    `**${world}** world bosses.`,
);
md.push("");
md.push("Drop each finished model into `client/public/models/` using the exact **File** name");
md.push("below; the matching template auto-loads it (no code change). See that folder's");
md.push("README for the format/orientation/rig spec.");
md.push("");
md.push("| ✅ | File | Name | Family | Tier | Lv | Element | Poly budget | Found In |");
md.push("|----|------|------|--------|------|----|---------|-------------|----------|");
const csv: string[] = ["file,template_id,name,family,tier,level,element,poly_budget,found_in"];
for (const t of all) {
  const file = `${t.id}.glb`;
  md.push(
    `| ☐ | \`${file}\` | ${t.name} | ${family(t)} | ${tier(t)} | ${t.level} | ${el(t)} | ${budget(t)} | ${where(t)} |`,
  );
  csv.push(
    [file, t.id, t.name, family(t), tier(t), t.level, el(t), budget(t), `"${where(t)}"`].join(","),
  );
}
md.push("");

const outDir = fileURLToPath(new URL("../docs/", import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + "MODEL_CHECKLIST.md", md.join("\n"));
writeFileSync(outDir + "model_checklist.csv", csv.join("\n") + "\n");
console.log(`wrote docs/MODEL_CHECKLIST.md + docs/model_checklist.csv (${all.length} rows)`);
