// Verifies the in-browser SOLO path: the same authoritative engine driven via
// LocalServer (the transport used when no WS server is reachable). Runs under tsx
// in Node — no DOM needed — and asserts join, spawns, combat and EXP gain. Also
// deterministically checks the item/equipment system at the engine level.
import { JobId, MsgType, StatusType, type ServerMessage } from "@rox/shared";
import { Monster, MONSTER_TEMPLATES, Player } from "@rox/engine";
import { LocalServer } from "../client/src/net/LocalServer.js";

const failures: string[] = [];
function check(cond: boolean, label: string): void {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failures.push(label);
  }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let selfId: number | null = null;
let lastSelf: any = null;
let damage = 0;
let skillDamage = 0;
let snapshots = 0;
const monsters = new Map<number, any>();

const local = new LocalServer({
  onMessage(m: ServerMessage) {
    if (m.t === MsgType.JoinAck) { selfId = m.selfId; lastSelf = m.self; }
    if (m.t === MsgType.Spawn && m.entity.kind === "monster") monsters.set(m.entity.id, m.entity);
    if (m.t === MsgType.Despawn) monsters.delete(m.id);
    if (m.t === MsgType.SelfSync) lastSelf = m.self;
    if (m.t === MsgType.DamageEvent) damage++;
    if (m.t === MsgType.DamageEvent && m.skillId) skillDamage++;
    if (m.t === MsgType.Snapshot) snapshots++;
  },
});

async function main(): Promise<void> {
  local.connect();
  local.send({ t: MsgType.Join, name: "Solo", job: "swordsman" as never });
  await wait(800);
  check(selfId != null, "solo: receives joinAck");
  check(monsters.size > 0, "solo: world spawns monsters");

  const startExp = lastSelf?.exp ?? 0;
  for (let i = 0; i < 50; i++) {
    const live = [...monsters.values()][0];
    if (live) {
      local.send({ t: MsgType.MoveIntent, x: live.x, z: live.z });
      local.send({ t: MsgType.AttackIntent, targetId: live.id });
      if (i % 4 === 0) local.send({ t: MsgType.SkillIntent, skillId: "bash", targetId: live.id });
    }
    await wait(200);
    if ((lastSelf?.exp ?? 0) > startExp || (lastSelf?.level ?? 1) > 1) break;
  }

  check(snapshots > 10, "solo: engine emits snapshots");
  check(damage > 0, "solo: combat produces damage");
  check(skillDamage > 0, "solo: skills produce damage");
  check((lastSelf.exp > startExp) || lastSelf.level > 1, "solo: killing monsters awards EXP");

  // ---- deterministic item / equipment checks (no RNG) ----
  const hero = new Player(999, 1, "Gearhead", JobId.Swordsman, 0, 0);
  const baseAtk = hero.derived.atk;
  hero.addItem("kings_cleaver", 1);
  check(hero.equip("kings_cleaver"), "items: equip a weapon from the bag");
  check(hero.derived.atk > baseAtk, "items: equipping raises ATK");
  check(hero.unequip("weapon" as never), "items: unequip returns the item");
  check(hero.derived.atk === baseAtk, "items: unequipping restores ATK");
  hero.hp = 1;
  hero.addItem("red_potion", 1);
  check(hero.useItem("red_potion"), "items: consumable is used");
  check(hero.hp > 1, "items: potion restores HP");

  // ---- deterministic job-advancement checks ----
  const cadet = new Player(998, 1, "Cadet", JobId.Swordsman, 0, 0);
  cadet.level = 5;
  check(!cadet.advanceJob(JobId.Knight), "jobs: cannot advance below level threshold");
  cadet.level = 25;
  check(cadet.advanceJob(JobId.Knight), "jobs: advance to 2nd job at threshold");
  check(cadet.job === JobId.Knight, "jobs: job id changes to Knight");
  check(!cadet.advanceJob(JobId.Wizard), "jobs: Knight has no further advancement");

  // ---- new class lines: Archer->Hunter, Acolyte->Priest ----
  const ranger = new Player(989, 1, "Ranger", JobId.Archer, 0, 0);
  check(ranger.skillLevel("double_strafe") === 1, "classes: Archer knows Double Strafe");
  ranger.level = 25;
  check(ranger.advanceJob(JobId.Hunter) && ranger.job === JobId.Hunter, "classes: Archer advances to Hunter");
  check(ranger.skillLevel("blitz_beat") === 1, "classes: Hunter learns Blitz Beat");
  const cleric = new Player(988, 1, "Cleric", JobId.Acolyte, 0, 0);
  check(cleric.skillLevel("heal") === 1, "classes: Acolyte knows Heal");
  cleric.level = 25;
  check(cleric.advanceJob(JobId.Priest) && cleric.job === JobId.Priest, "classes: Acolyte advances to Priest");

  // ---- deterministic shop checks ----
  const buyer = new Player(997, 1, "Buyer", JobId.Novice, 0, 0);
  buyer.zeny = 1000;
  check(buyer.buy("red_potion", 2), "shop: buy deducts Zeny and adds items");
  check(buyer.zeny === 900 && (buyer.toSelfState().inventory.find((i) => i.id === "red_potion")?.qty ?? 0) === 2, "shop: buy result correct");
  check(!buyer.buy("kings_cleaver", 1), "shop: cannot buy non-stocked item");
  check(buyer.sell("red_potion", 1), "shop: sell returns Zeny");
  check(buyer.zeny === 912, "shop: sell credited correct Zeny");

  // ---- deterministic quest checks ----
  const quester = new Player(996, 1, "Quester", JobId.Swordsman, 0, 0);
  quester.level = 5;
  check(quester.acceptQuest("poring_purge"), "quests: accept a quest");
  check(!quester.acceptQuest("poring_purge"), "quests: cannot double-accept");
  check(!quester.acceptQuest("slay_the_king"), "quests: blocked below required level");
  check(quester.claimQuest("poring_purge") === null, "quests: cannot claim before complete");
  for (let i = 0; i < 10; i++) quester.creditKill("poring");
  const qZeny = quester.zeny;
  check(quester.claimQuest("poring_purge") !== null, "quests: claim when objective met");
  check(quester.zeny === qZeny + 80, "quests: reward Zeny credited");
  check((quester.toSelfState().inventory.find((i) => i.id === "red_potion")?.qty ?? 0) >= 3, "quests: reward items granted");
  check(quester.completedQuests.includes("poring_purge"), "quests: marked completed");
  check(!quester.acceptQuest("poring_purge"), "quests: cannot re-accept completed");

  // ---- deterministic stat allocation ----
  const statter = new Player(995, 1, "Statter", JobId.Swordsman, 0, 0);
  statter.statPoints = 2;
  const baseStr = statter.stats.str;
  check(statter.allocateStat("str"), "stats: allocate a point");
  check(statter.stats.str === baseStr + 1 && statter.statPoints === 1, "stats: STR raised, pool reduced");
  check(!statter.allocateStat("bogus"), "stats: invalid stat rejected");
  statter.statPoints = 0;
  check(!statter.allocateStat("vit"), "stats: cannot allocate with no points");

  // ---- deterministic refinement ----
  const smith = new Player(994, 1, "Smith", JobId.Swordsman, 0, 0);
  smith.addItem("novice_knife", 1);
  smith.equip("novice_knife");
  const baseAtk2 = smith.derived.atk;
  smith.zeny = 10000;
  check(smith.refineEquipped("weapon" as never), "refine: upgrade equipped weapon");
  check(smith.derived.atk > baseAtk2, "refine: ATK increased after refine");
  check(smith.zeny < 10000, "refine: Zeny spent on refine");

  // ---- deterministic skill levels ----
  const mage = new Player(993, 1, "Wiz", JobId.Mage, 0, 0);
  check(mage.skillLevel("fire_bolt") === 1, "skills: job skills start at level 1");
  check(!mage.levelSkill("fire_bolt"), "skills: cannot level without points");
  mage.skillPoints = 2;
  check(mage.levelSkill("fire_bolt"), "skills: spend a point to level a skill");
  check(mage.skillLevel("fire_bolt") === 2 && mage.skillPoints === 1, "skills: level raised, point spent");
  check(!mage.levelSkill("pierce"), "skills: cannot level a skill outside the job kit");

  // ---- deterministic persistence round-trip (solo save/load) ----
  const orig = new Player(992, 1, "Hero", JobId.Swordsman, 0, 0);
  orig.zeny = 555;
  orig.addItem("red_potion", 4);
  orig.addItem("novice_knife", 1);
  orig.equip("novice_knife");
  orig.gainExp(100000); // level up several times
  const saved = JSON.parse(JSON.stringify(orig.toSelfState()));
  const loaded = new Player(991, 1, "X", JobId.Novice, 0, 0);
  loaded.restore(saved);
  check(loaded.level === orig.level && loaded.zeny === 555 && loaded.job === orig.job, "persistence: core fields restored");
  check((loaded.toSelfState().inventory.find((i) => i.id === "red_potion")?.qty ?? 0) === 4, "persistence: inventory restored");
  check(loaded.equipped.weapon === "novice_knife", "persistence: equipment restored");

  // ---- deterministic status effects ----
  const mob = new Monster(1, MONSTER_TEMPLATES.poring, "z", "field", 0, 0);
  const now = Date.now();
  mob.addStatus(StatusType.Burn, 2000, 42, now, 10);
  const ticks = mob.tickStatuses(now + 650);
  check(ticks.length >= 1 && ticks[0].amount === 10 && ticks[0].sourceId === 42, "status: burn deals DoT");
  mob.addStatus(StatusType.Slow, 2000, 42, now, 0.5);
  check(mob.speedMul(now + 100) === 0.5, "status: slow reduces speed");
  mob.addStatus(StatusType.Stun, 1000, 42, now);
  check(mob.isStunned(now + 100), "status: stun is active");
  check(!mob.isStunned(now + 2000), "status: stun expires");

  // ---- deterministic player buffs ----
  const buffed = new Player(990, 1, "Buffed", JobId.Swordsman, 0, 0);
  check(buffed.buffMul("atk", now) === 1, "buff: no buff = 1x");
  buffed.addBuff("atk", 1.3, 15000, now);
  check(Math.abs(buffed.buffMul("atk", now + 100) - 1.3) < 1e-9, "buff: ATK buff multiplies");
  check(buffed.buffMul("atk", now + 16000) === 1, "buff: expires after duration");

  local.stop();
  if (failures.length) {
    console.error(`\nSOLO TEST FAILED (${failures.length}): ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("\nSOLO TEST PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error("solo test error:", e);
  process.exit(1);
});
