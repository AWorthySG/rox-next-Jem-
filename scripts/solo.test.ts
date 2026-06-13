// Verifies the in-browser SOLO path: the same authoritative engine driven via
// LocalServer (the transport used when no WS server is reachable). Runs under tsx
// in Node — no DOM needed — and asserts join, spawns, combat and EXP gain. Also
// deterministically checks the item/equipment system at the engine level.
import { JobId, MsgType, type ServerMessage } from "@rox/shared";
import { Player } from "@rox/engine";
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
