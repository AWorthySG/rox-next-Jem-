// Verifies the in-browser SOLO path: the same authoritative engine driven via
// LocalServer (the transport used when no WS server is reachable). Runs under tsx
// in Node — no DOM needed — and asserts join, spawns, combat and EXP gain. Also
// deterministically checks the item/equipment system at the engine level.
import {
  DamageKind,
  Element,
  jobTierOf,
  advanceOptions,
  effectiveCastMs,
  elementMultiplier,
  environmentMultiplier,
  daylight,
  isNight,
  rollWeather,
  Weather,
  afterCastDelayMs,
  getItem,
  getSkill,
  skillCooldownMs,
  skillEffectDurationMs,
  itemEquippableBy,
  JobId,
  MsgType,
  rarityOf,
  refineMaterial,
  resolveAttack,
  StatusType,
  tierOf,
  TIER_NAME,
  LEVEL_CAP,
  xpToNext,
  guildXpToNext,
  GATHER_COOLDOWN_MS,
  lifeSkillXpToNext,
  rollGather,
  GATHER_STAMINA_COST,
  STAMINA_MAX,
  STAMINA_REGEN_MS,
  SIEGE_REWARD_INTERVAL_MS,
  SIEGE_WINDOW_MS,
  MonsterAIState,
  type DerivedStats,
  type ServerMessage,
} from "@rox/shared";
import { ExchangeSystem, MAPS, Monster, MONSTER_TEMPLATES, Player, TOWER_ENTRY_ZENY, World } from "@rox/engine";
import { LocalServer } from "../client/src/net/LocalServer.js";
import { lodTier, labelVisible } from "../client/src/entities/lod.js";

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

  // ---- 3rd-job (transcendent) advancement ----
  const rk = new Player(987, 1, "Trans", JobId.Knight, 0, 0);
  rk.level = 40;
  check(!rk.advanceJob(JobId.RuneKnight), "3rd job: blocked before Lv45");
  rk.level = 45;
  check(rk.advanceJob(JobId.RuneKnight) && rk.job === JobId.RuneKnight, "3rd job: Knight -> Rune Knight at Lv45");
  check(rk.skillLevel("dragon_breath") === 1, "3rd job: Rune Knight learns Dragon Breath");

  // ---- 4th-job advancement + level cap 130 ----
  check(LEVEL_CAP === 130, "progression: level cap is 130");
  check(!isFinite(xpToNext(130)), "progression: no XP needed beyond cap");
  rk.level = 69;
  check(!rk.advanceJob(JobId.DragonKnight), "4th job: blocked before Lv70");
  rk.level = 70;
  check(rk.advanceJob(JobId.DragonKnight) && rk.job === JobId.DragonKnight, "4th job: Rune Knight -> Dragon Knight at Lv70");
  check(rk.skillLevel("storm_slash") === 1, "4th job: Dragon Knight learns Storm Slash");

  // ---- job tier helper (drives back-wing visuals) ----
  check(jobTierOf(JobId.Novice) === 0, "tier: Novice is tier 0");
  check(jobTierOf(JobId.Swordsman) === 1, "tier: Swordsman is tier 1");
  check(jobTierOf(JobId.RuneKnight) === 3, "tier: Rune Knight is tier 3");
  check(jobTierOf(JobId.Cardinal) === 4, "tier: Cardinal is tier 4");

  // ---- Thief line: Thief -> Assassin -> Guillotine Cross -> Shadow Cross ----
  const rogue = new Player(963, 1, "Rogue", JobId.Thief, 0, 0);
  check(rogue.skillLevel("envenom") === 1, "classes: Thief knows Envenom");
  rogue.level = 25;
  check(rogue.advanceJob(JobId.Assassin) && rogue.job === JobId.Assassin, "classes: Thief advances to Assassin");
  check(rogue.skillLevel("sonic_blow") === 1, "classes: Assassin learns Sonic Blow");
  rogue.level = 45;
  check(rogue.advanceJob(JobId.GuillotineCross) && rogue.job === JobId.GuillotineCross, "3rd job: Assassin -> Guillotine Cross at Lv45");
  check(rogue.skillLevel("cross_impact") === 1, "3rd job: Guillotine Cross learns Cross Impact");
  rogue.level = 70;
  check(rogue.advanceJob(JobId.ShadowCross) && rogue.job === JobId.ShadowCross, "4th job: Guillotine Cross -> Shadow Cross at Lv70");
  check(rogue.skillLevel("soul_breaker") === 1, "4th job: Shadow Cross learns Soul Breaker");
  check(jobTierOf(JobId.ShadowCross) === 4, "tier: Shadow Cross is tier 4");

  // ---- Merchant line: Merchant -> Blacksmith -> Whitesmith -> Mechanic ----
  const trader = new Player(962, 1, "Trader", JobId.Merchant, 0, 0);
  check(trader.skillLevel("mammonite") === 1, "classes: Merchant knows Mammonite");
  trader.level = 25;
  check(trader.advanceJob(JobId.Blacksmith) && trader.job === JobId.Blacksmith, "classes: Merchant advances to Blacksmith");
  check(trader.skillLevel("cart_revolution") === 1, "classes: Blacksmith learns Cart Revolution");
  trader.level = 45;
  check(trader.advanceJob(JobId.Whitesmith) && trader.job === JobId.Whitesmith, "3rd job: Blacksmith -> Whitesmith at Lv45");
  check(trader.skillLevel("meltdown") === 1, "3rd job: Whitesmith learns Meltdown");
  trader.level = 70;
  check(trader.advanceJob(JobId.Mechanic) && trader.job === JobId.Mechanic, "4th job: Whitesmith -> Mechanic at Lv70");
  check(trader.skillLevel("axe_tornado") === 1, "4th job: Mechanic learns Axe Tornado");
  check(jobTierOf(JobId.Mechanic) === 4, "tier: Mechanic is tier 4");

  // ---- new class gear fits its own family only ----
  check(itemEquippableBy(getItem("nightblade")!, JobId.Thief), "class: dagger gear fits a Thief");
  check(itemEquippableBy(getItem("nightblade")!, JobId.ShadowCross), "class: dagger gear fits Shadow Cross");
  check(!itemEquippableBy(getItem("nightblade")!, JobId.Merchant), "class: a Merchant cannot use dagger gear");
  check(itemEquippableBy(getItem("golden_axe")!, JobId.Mechanic), "class: axe gear fits a Mechanic");
  check(!itemEquippableBy(getItem("golden_axe")!, JobId.Thief), "class: a Thief cannot use axe gear");

  // ---- branching 2nd jobs: Swordsman/Mage/Acolyte each get a second path ----
  const swordOptions = advanceOptions(JobId.Swordsman, 25);
  check(swordOptions.includes(JobId.Knight) && swordOptions.includes(JobId.Crusader), "branch: Swordsman can advance to Knight or Crusader");
  const mageOptions = advanceOptions(JobId.Mage, 25);
  check(mageOptions.includes(JobId.Wizard) && mageOptions.includes(JobId.Sage), "branch: Mage can advance to Wizard or Sage");
  const acolyteOptions = advanceOptions(JobId.Acolyte, 25);
  check(acolyteOptions.includes(JobId.Priest) && acolyteOptions.includes(JobId.Monk), "branch: Acolyte can advance to Priest or Monk");

  // ---- Crusader line: Swordsman -> Crusader -> Paladin -> Royal Guard ----
  const templar = new Player(945, 1, "Templar", JobId.Swordsman, 0, 0);
  templar.level = 25;
  check(templar.advanceJob(JobId.Crusader) && templar.job === JobId.Crusader, "classes: Swordsman advances to Crusader");
  check(templar.skillLevel("shield_charge") === 1, "classes: Crusader learns Shield Charge");
  check(jobTierOf(JobId.Crusader) === 2, "tier: Crusader is tier 2");
  templar.level = 45;
  check(templar.advanceJob(JobId.Paladin) && templar.job === JobId.Paladin, "3rd job: Crusader -> Paladin at Lv45");
  check(templar.skillLevel("shield_chain") === 1, "3rd job: Paladin learns Shield Chain");
  check(jobTierOf(JobId.Paladin) === 3, "tier: Paladin is tier 3");
  templar.level = 70;
  check(templar.advanceJob(JobId.RoyalGuard) && templar.job === JobId.RoyalGuard, "4th job: Paladin -> Royal Guard at Lv70");
  check(templar.skillLevel("overbrand") === 1, "4th job: Royal Guard learns Overbrand");
  check(jobTierOf(JobId.RoyalGuard) === 4, "tier: Royal Guard is tier 4");
  check(itemEquippableBy(getItem("vanguard_greatsword")!, JobId.RoyalGuard), "class: sword-family gear also fits a Royal Guard");

  // ---- Sage line: Mage -> Sage -> Professor -> Chronomancer ----
  const scholar = new Player(944, 1, "Scholar", JobId.Mage, 0, 0);
  scholar.level = 25;
  check(scholar.advanceJob(JobId.Sage) && scholar.job === JobId.Sage, "classes: Mage advances to Sage");
  check(scholar.skillLevel("arcane_lance") === 1, "classes: Sage learns Arcane Lance");
  check(jobTierOf(JobId.Sage) === 2, "tier: Sage is tier 2");
  scholar.level = 45;
  check(scholar.advanceJob(JobId.Professor) && scholar.job === JobId.Professor, "3rd job: Sage -> Professor at Lv45");
  check(scholar.skillLevel("grand_sage_nova") === 1, "3rd job: Professor learns Grand Sage Nova");
  check(jobTierOf(JobId.Professor) === 3, "tier: Professor is tier 3");
  check(!scholar.advanceJob(JobId.ArchMage), "3rd job: Professor cannot cross into the Wizard branch");
  check(itemEquippableBy(getItem("archmage_rod")!, JobId.Professor), "class: mage-family gear also fits a Professor");
  scholar.level = 70;
  check(scholar.advanceJob(JobId.Chronomancer) && scholar.job === JobId.Chronomancer, "4th job: Professor -> Chronomancer at Lv70");
  check(scholar.skillLevel("temporal_rift") === 1, "4th job: Chronomancer learns Temporal Rift");
  check(jobTierOf(JobId.Chronomancer) === 4, "tier: Chronomancer is tier 4");
  check(itemEquippableBy(getItem("archmage_rod")!, JobId.Chronomancer), "class: mage-family gear also fits a Chronomancer");

  // ---- Monk line: Acolyte -> Monk -> Champion -> Dragon Fist ----
  const brawler = new Player(943, 1, "Brawler", JobId.Acolyte, 0, 0);
  brawler.level = 25;
  check(brawler.advanceJob(JobId.Monk) && brawler.job === JobId.Monk, "classes: Acolyte advances to Monk");
  check(brawler.skillLevel("chain_combo") === 1, "classes: Monk learns Chain Combo");
  check(jobTierOf(JobId.Monk) === 2, "tier: Monk is tier 2");
  brawler.level = 45;
  check(brawler.advanceJob(JobId.Champion) && brawler.job === JobId.Champion, "3rd job: Monk -> Champion at Lv45");
  check(brawler.skillLevel("asura_strike") === 1, "3rd job: Champion learns Asura Strike");
  check(jobTierOf(JobId.Champion) === 3, "tier: Champion is tier 3");
  check(itemEquippableBy(getItem("saints_mace")!, JobId.Champion), "class: acolyte-family gear also fits a Champion");
  brawler.level = 70;
  check(brawler.advanceJob(JobId.DragonFist) && brawler.job === JobId.DragonFist, "4th job: Champion -> Dragon Fist at Lv70");
  check(brawler.skillLevel("dragon_blood_fist") === 1, "4th job: Dragon Fist learns Dragon Blood Fist");
  check(jobTierOf(JobId.DragonFist) === 4, "tier: Dragon Fist is tier 4");

  // ---- branching 2nd jobs, round B: Thief/Archer/Merchant get a second path ----
  const thiefOptions = advanceOptions(JobId.Thief, 25);
  check(thiefOptions.includes(JobId.Assassin) && thiefOptions.includes(JobId.Rogue), "branch: Thief can advance to Assassin or Rogue");
  const archerOptions = advanceOptions(JobId.Archer, 25);
  check(archerOptions.includes(JobId.Hunter) && archerOptions.includes(JobId.Bard), "branch: Archer can advance to Hunter or Bard");
  const merchantOptions = advanceOptions(JobId.Merchant, 25);
  check(merchantOptions.includes(JobId.Blacksmith) && merchantOptions.includes(JobId.Alchemist), "branch: Merchant can advance to Blacksmith or Alchemist");

  // ---- Rogue line: Thief -> Rogue -> Stalker -> Phantom Dancer ----
  const sneak = new Player(942, 1, "Sneak", JobId.Thief, 0, 0);
  sneak.level = 25;
  check(sneak.advanceJob(JobId.Rogue) && sneak.job === JobId.Rogue, "classes: Thief advances to Rogue");
  check(sneak.skillLevel("backstab") === 1, "classes: Rogue learns Backstab");
  check(jobTierOf(JobId.Rogue) === 2, "tier: Rogue is tier 2");
  sneak.level = 45;
  check(sneak.advanceJob(JobId.Stalker) && sneak.job === JobId.Stalker, "3rd job: Rogue -> Stalker at Lv45");
  check(sneak.skillLevel("shadow_reaper") === 1, "3rd job: Stalker learns Shadow Reaper");
  check(jobTierOf(JobId.Stalker) === 3, "tier: Stalker is tier 3");
  check(itemEquippableBy(getItem("nightblade")!, JobId.Stalker), "class: thief-family gear also fits a Stalker");
  sneak.level = 70;
  check(sneak.advanceJob(JobId.PhantomDancer) && sneak.job === JobId.PhantomDancer, "4th job: Stalker -> Phantom Dancer at Lv70");
  check(sneak.skillLevel("phantom_waltz") === 1, "4th job: Phantom Dancer learns Phantom Waltz");
  check(jobTierOf(JobId.PhantomDancer) === 4, "tier: Phantom Dancer is tier 4");

  // ---- Bard line: Archer -> Bard -> Minstrel -> Maestro ----
  const singer = new Player(941, 1, "Singer", JobId.Archer, 0, 0);
  singer.level = 25;
  check(singer.advanceJob(JobId.Bard) && singer.job === JobId.Bard, "classes: Archer advances to Bard");
  check(singer.skillLevel("battle_hymn") === 1, "classes: Bard learns Battle Hymn");
  check(jobTierOf(JobId.Bard) === 2, "tier: Bard is tier 2");
  singer.level = 45;
  check(singer.advanceJob(JobId.Minstrel) && singer.job === JobId.Minstrel, "3rd job: Bard -> Minstrel at Lv45");
  check(singer.skillLevel("severe_rainstorm") === 1, "3rd job: Minstrel learns Severe Rainstorm");
  check(jobTierOf(JobId.Minstrel) === 3, "tier: Minstrel is tier 3");
  check(itemEquippableBy(getItem("ranger_longbow")!, JobId.Minstrel), "class: archer-family gear also fits a Minstrel");
  singer.level = 70;
  check(singer.advanceJob(JobId.Maestro) && singer.job === JobId.Maestro, "4th job: Minstrel -> Maestro at Lv70");
  check(singer.skillLevel("grand_symphony") === 1, "4th job: Maestro learns Grand Symphony");
  check(jobTierOf(JobId.Maestro) === 4, "tier: Maestro is tier 4");

  // ---- Alchemist line: Merchant -> Alchemist -> Creator -> Begetter ----
  const chemist = new Player(940, 1, "Chemist", JobId.Merchant, 0, 0);
  chemist.level = 25;
  check(chemist.advanceJob(JobId.Alchemist) && chemist.job === JobId.Alchemist, "classes: Merchant advances to Alchemist");
  check(chemist.skillLevel("acid_bomb") === 1, "classes: Alchemist learns Acid Bomb");
  check(jobTierOf(JobId.Alchemist) === 2, "tier: Alchemist is tier 2");
  chemist.level = 45;
  check(chemist.advanceJob(JobId.Creator) && chemist.job === JobId.Creator, "3rd job: Alchemist -> Creator at Lv45");
  check(chemist.skillLevel("plague_flask") === 1, "3rd job: Creator learns Plague Flask");
  check(jobTierOf(JobId.Creator) === 3, "tier: Creator is tier 3");
  check(itemEquippableBy(getItem("golden_axe")!, JobId.Creator), "class: merchant-family gear also fits a Creator");
  chemist.level = 70;
  check(chemist.advanceJob(JobId.Begetter) && chemist.job === JobId.Begetter, "4th job: Creator -> Begetter at Lv70");
  check(chemist.skillLevel("hell_plant") === 1, "4th job: Begetter learns Hell Plant");
  check(jobTierOf(JobId.Begetter) === 4, "tier: Begetter is tier 4");
  check(itemEquippableBy(getItem("golden_axe")!, JobId.Begetter), "class: merchant-family gear also fits a Begetter");

  // ---- 4th-job gate: a Lv69 3rd-job cannot advance early ----
  const early = new Player(939, 1, "Early", JobId.Novice, 0, 0);
  early.level = 10;
  early.advanceJob(JobId.Acolyte);
  early.level = 25;
  early.advanceJob(JobId.Monk);
  early.level = 45;
  early.advanceJob(JobId.Champion);
  early.level = 69;
  check(!early.advanceJob(JobId.DragonFist), "4th job: Champion cannot become Dragon Fist below Lv70");
  check(advanceOptions(JobId.Champion, 69).length === 0, "4th job: no options offered below Lv70");
  check(advanceOptions(JobId.Champion, 70).includes(JobId.DragonFist), "4th job: Dragon Fist offered at Lv70");

  // ---- every combat map has at least two bosses ----
  for (const m of Object.values(MAPS)) {
    if (m.zones.length === 0) continue; // PvP arena (no monster zones)
    const bosses = m.zones.filter((z) => MONSTER_TEMPLATES[z.templateId]?.boss).length;
    check(bosses >= 2, `world: ${m.id} has >= 2 bosses (${bosses})`);
  }

  // ---- endgame content (Morocc / Bio Lab / Abyss) ----
  for (const id of ["morocc", "bio_lab", "abyss"]) check(!!MAPS[id], `content: ${id} map exists`);
  check(MAPS.thanatos.npcs.some((n) => n.dest?.toMap === "morocc"), "content: Thanatos links to Morocc");
  check(MONSTER_TEMPLATES.nidhoggr?.level === 130, "content: Nidhoggr is the Lv130 capstone");
  check((MONSTER_TEMPLATES.satan_morroc.mechanics?.length ?? 0) === 4, "content: Satan Morroc has all four mechanics");
  for (const it of ["abyssal_blade", "dragon_scale_mail", "nidhoggr_eye", "desert_sabre", "oridecon", "elunium"]) {
    check(!!getItem(it), `content: item ${it} exists`);
  }

  // ---- boss mechanics ----
  const withMech = Object.values(MONSTER_TEMPLATES).filter((t) => t.boss && (t.mechanics?.length ?? 0) > 0).length;
  check(withMech >= 12, `boss mechanics: ${withMech} bosses have mechanics`);
  check((MONSTER_TEMPLATES.beelzebub.mechanics?.length ?? 0) === 4, "boss mechanics: Beelzebub has all four");
  check(!!MONSTER_TEMPLATES.baphomet.mechanics?.some((x) => x.kind === "enrage"), "boss mechanics: Baphomet enrages");
  check(!!MONSTER_TEMPLATES.dark_lord.mechanics?.some((x) => x.kind === "summon"), "boss mechanics: Dark Lord summons");

  // ---- deterministic achievements ----
  const hero2 = new Player(984, 1, "Achiever", JobId.Swordsman, 0, 0);
  hero2.recordKill("poring", false);
  let unlocked = hero2.evaluateAchievements().map((a) => a.id);
  check(unlocked.includes("first_blood"), "achievement: first kill unlocks First Blood");
  check(hero2.achievements.includes("first_blood"), "achievement: recorded as completed");
  hero2.recordKill("poring_king", true);
  unlocked = hero2.evaluateAchievements().map((a) => a.id);
  check(unlocked.includes("regicide"), "achievement: slaying Poring King unlocks Regicide");
  check(hero2.evaluateAchievements().length === 0, "achievement: no double-unlock");

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
  smith.zeny = 100000;
  check(smith.refineEquipped("weapon" as never) === null, "refine: blocked without ore");
  smith.addItem("oridecon", 5);
  const okWeapon = smith.refineEquipped("weapon" as never, () => 0); // safe → always succeeds
  check(!!okWeapon && okWeapon.success && okWeapon.level === 1, "refine: safe refine succeeds (+1)");
  check(smith.derived.atk > baseAtk2, "refine: ATK increased after refine");
  check(smith.zeny < 100000, "refine: Zeny spent on refine");
  check((smith.toSelfState().inventory.find((i) => i.id === "oridecon")?.qty ?? 0) === 4, "refine: one ore consumed");
  check(refineMaterial(getItem("novice_knife")!) === "oridecon", "refine: weapons use Oridecon");

  // accessory refine now grants stats (previously a no-op for bonusStats-only gear)
  const jeweler = new Player(967, 1, "Jeweler", JobId.Novice, 0, 0);
  jeweler.zeny = 100000;
  jeweler.addItem("ring_of_power", 1);
  jeweler.equip("ring_of_power");
  jeweler.addItem("elunium", 3);
  const hpBeforeRing = jeweler.derived.maxHp;
  const okRing = jeweler.refineEquipped("accessory" as never, () => 0);
  check(!!okRing && okRing.success, "refine: accessory can be refined");
  check(jeweler.derived.maxHp > hpBeforeRing, "refine: accessory refine grants Max HP (bug fix)");
  check(refineMaterial(getItem("ring_of_power")!) === "elunium", "refine: accessories use Elunium");

  // above the safe line, refines can fail (ore + zeny consumed, level unchanged)
  const gambler = new Player(966, 1, "Gambler", JobId.Swordsman, 0, 0);
  gambler.zeny = 1_000_000;
  gambler.addItem("novice_knife", 1);
  gambler.equip("novice_knife");
  gambler.addItem("oridecon", 20);
  for (let i = 0; i < 4; i++) gambler.refineEquipped("weapon" as never, () => 0); // to +4 (safe)
  check((gambler.toSelfState().refine.find((r) => r.id === "novice_knife")?.level ?? 0) === 4, "refine: reached +4 safely");
  const oreBeforeFail = gambler.inventory["oridecon"];
  const failAttempt = gambler.refineEquipped("weapon" as never, () => 0.99); // +4→+5 forced fail
  check(!!failAttempt && !failAttempt.success && failAttempt.level === 4, "refine: risky refine can fail, level unchanged");
  check(gambler.inventory["oridecon"] === oreBeforeFail - 1, "refine: failed attempt still consumes an ore");

  // ---- deterministic card sockets ----
  const carder = new Player(983, 1, "Carder", JobId.Swordsman, 0, 0);
  carder.addItem("novice_knife", 1);
  carder.equip("novice_knife");
  const atkNoCard = carder.derived.atk;
  carder.addItem("skeleton_card", 1);
  check(!carder.socketCard("poring_card"), "cards: cannot socket a card you don't own");
  check(carder.socketCard("skeleton_card"), "cards: socket a weapon card");
  check(carder.derived.atk > atkNoCard, "cards: socketed card raises ATK");
  carder.unequip("weapon" as never);
  check((carder.toSelfState().inventory.find((i) => i.id === "skeleton_card")?.qty ?? 0) === 1, "cards: unequipping returns the card");

  // ---- deterministic repeatable bounties ----
  const bounty = new Player(969, 1, "Bounty", JobId.Swordsman, 0, 0);
  bounty.level = 5;
  check(bounty.acceptQuest("bounty_porings"), "bounty: accept a repeatable quest");
  for (let i = 0; i < 15; i++) bounty.creditKill("poring");
  check(bounty.claimQuest("bounty_porings") !== null, "bounty: claim when complete");
  check(!bounty.completedQuests.includes("bounty_porings"), "bounty: repeatable does NOT lock as completed");
  check(bounty.acceptQuest("bounty_porings"), "bounty: can re-accept immediately");
  // a normal (non-repeatable) quest still locks out after claiming
  const oneShot = new Player(968, 1, "OneShot", JobId.Swordsman, 0, 0);
  oneShot.level = 5;
  oneShot.acceptQuest("poring_purge");
  for (let i = 0; i < 10; i++) oneShot.creditKill("poring");
  oneShot.claimQuest("poring_purge");
  check(oneShot.completedQuests.includes("poring_purge"), "bounty: normal quest still locks once done");
  check(!oneShot.acceptQuest("poring_purge"), "bounty: normal quest cannot be re-accepted");

  // ---- deterministic Monster Codex (kill counts) ----
  const hunter = new Player(971, 1, "Hunter", JobId.Archer, 0, 0);
  hunter.recordKill("poring", false);
  hunter.recordKill("poring", false);
  hunter.recordKill("baphomet", true);
  check(hunter.killCounts["poring"] === 2, "codex: kill tally increments per species");
  check(hunter.killCounts["baphomet"] === 1, "codex: boss kills tracked too");
  check(hunter.toSelfState().killCounts.find((k) => k.id === "poring")?.count === 2, "codex: surfaced in self state");
  const dexLoaded = new Player(970, 1, "X", JobId.Novice, 0, 0);
  dexLoaded.restore(hunter.toSelfState());
  check(dexLoaded.killCounts["poring"] === 2, "codex: persists across save/load");

  // ---- deterministic elemental system ----
  check(elementMultiplier(Element.Fire, Element.Earth) === 1.5, "element: Fire is strong vs Earth");
  check(elementMultiplier(Element.Fire, Element.Water) === 0.5, "element: Fire is weak vs Water");
  check(elementMultiplier(Element.Holy, Element.Shadow) === 1.75, "element: Holy scorches Shadow");
  check(elementMultiplier(Element.Neutral, Element.Fire) === 1, "element: Neutral is even all round");
  // resolveAttack applies the chart: same rolls, Fire-vs-Earth out-damages Fire-vs-Water
  const atk: DerivedStats = { maxHp: 100, maxSp: 50, atk: 200, matk: 200, def: 0, hit: 999, flee: 0, crit: 0 };
  const tgt: DerivedStats = { maxHp: 100, maxSp: 50, atk: 0, matk: 0, def: 0, hit: 0, flee: 0, crit: 0 };
  const fixed = () => 0.5; // deterministic mid-roll, no crit, always hits
  const vsEarth = resolveAttack(atk, tgt, DamageKind.Magic, fixed, 1, { attack: Element.Fire, defense: Element.Earth });
  const vsWater = resolveAttack(atk, tgt, DamageKind.Magic, fixed, 1, { attack: Element.Fire, defense: Element.Water });
  check(vsEarth.amount > vsWater.amount, "element: chart scales resolved damage (Earth > Water target)");
  check(vsEarth.elementMult === 1.5 && vsWater.elementMult === 0.5, "element: multiplier reported on the result");
  // monster templates carry a defensive element
  check(MONSTER_TEMPLATES["boitata"].element === Element.Fire, "element: Boitata is a Fire monster");
  check((MONSTER_TEMPLATES["poring"].element ?? "neutral") === Element.Water, "element: Poring is Water");

  // ---- deterministic food/cooking buffs ----
  const eater = new Player(972, 1, "Gourmet", JobId.Swordsman, 0, 0);
  const atkBase = eater.derived.atk;
  const t0 = 1_000_000;
  check(eater.applyFood("spicy_skewer", t0), "food: eating applies a timed buff"); // 5 min
  const atkSpicy = eater.derived.atk;
  check(atkSpicy > atkBase, "food: Spicy Skewer raises ATK");
  check(eater.applyFood("royal_feast", t0), "food: a second food stacks"); // 10 min
  check(eater.derived.atk > atkSpicy, "food: stacked food raises ATK further");
  // re-eating refreshes rather than duplicating
  eater.applyFood("spicy_skewer", t0 + 1000);
  check(eater.foodBuffs.filter((b) => b.id === "spicy_skewer").length === 1, "food: re-eating refreshes (no duplicate)");
  // expiry: the 5-min skewer lapses by t0+350s, the 10-min feast persists
  check(eater.tickFoodBuffs(t0 + 350000), "food: expiry tick removes a lapsed buff");
  check(!eater.foodBuffs.some((b) => b.id === "spicy_skewer"), "food: lapsed buff dropped");
  check(eater.foodBuffs.some((b) => b.id === "royal_feast"), "food: longer buff still active");
  check(eater.derived.atk > atkBase && eater.derived.atk < atkSpicy + 100, "food: stats reflect only active buffs after expiry");

  // ---- deterministic Kafra storage ----
  const banker = new Player(974, 1, "Banker", JobId.Novice, 0, 0);
  banker.addItem("red_potion", 5);
  check(banker.storeItem("red_potion", 3), "storage: deposit items from bag");
  check((banker.inventory["red_potion"] ?? 0) === 2, "storage: bag count reduced");
  check((banker.storage["red_potion"] ?? 0) === 3, "storage: storage count raised");
  check(!banker.storeItem("blue_potion", 1), "storage: cannot deposit items you lack");
  check(banker.retrieveItem("red_potion", 10), "storage: withdraw clamps to available");
  check((banker.storage["red_potion"] ?? 0) === 0 && (banker.inventory["red_potion"] ?? 0) === 5, "storage: withdraw returns to bag");
  banker.storeItem("red_potion", 2);
  const bankLoaded = new Player(973, 1, "X", JobId.Novice, 0, 0);
  bankLoaded.restore(banker.toSelfState());
  check((bankLoaded.storage["red_potion"] ?? 0) === 2, "storage: persists across save/load");

  // ---- deterministic headgear slot ----
  const hatter = new Player(975, 1, "Hatter", JobId.Swordsman, 0, 0);
  const hpNoHat = hatter.derived.maxHp;
  hatter.addItem("poring_hat", 1);
  check(hatter.equip("poring_hat"), "headgear: equip a hat into the head slot");
  check(hatter.derived.maxHp > hpNoHat, "headgear: hat raises Max HP");
  check(hatter.toSelfState().equipped.some((e) => e.slot === "headgear"), "headgear: surfaced in self state");
  check(hatter.toFull().headgear === "poring_hat", "headgear: broadcast in EntityFull for rendering");
  hatter.addItem("willow_card", 1);
  const spNoCard = hatter.derived.maxSp;
  check(hatter.socketCard("willow_card"), "headgear: socket a headgear card");
  check(hatter.derived.maxSp > spNoCard, "headgear: socketed card raises Max SP");
  check(hatter.unequip("headgear" as never), "headgear: unequip the hat");
  check((hatter.toSelfState().inventory.find((i) => i.id === "willow_card")?.qty ?? 0) === 1, "headgear: unequip returns the card");

  // ---- deterministic gear enchantment ----
  const ench = new Player(977, 1, "Enchanter", JobId.Swordsman, 0, 0);
  ench.addItem("novice_knife", 1);
  ench.equip("novice_knife");
  check(!ench.enchantItem("weapon" as never), "enchant: blocked without enough Zeny");
  ench.zeny = 200000;
  check(ench.enchantItem("weapon" as never), "enchant: roll lines on equipped weapon");
  check((ench.enchantByItem["novice_knife"]?.length ?? 0) === 3, "enchant: fills three lines");
  check(ench.zeny === 150000, "enchant: Zeny deducted per roll");
  // lock the first line, capture it, re-roll, confirm it survived
  check(ench.toggleEnchantLock("weapon" as never, 0), "enchant: lock a line");
  const lockedLine = { ...ench.enchantByItem["novice_knife"][0] };
  ench.enchantItem("weapon" as never);
  const after = ench.enchantByItem["novice_knife"][0];
  check(
    after.locked && after.stat === lockedLine.stat && after.value === lockedLine.value,
    "enchant: locked line survives a re-roll",
  );
  // enchant lines survive a save/load round-trip and affect derived stats
  const enchSaved = ench.toSelfState();
  check((enchSaved.enchants.find((e) => e.id === "novice_knife")?.lines.length ?? 0) === 3, "enchant: serialized in SelfState");
  const enchLoaded = new Player(976, 1, "X", JobId.Novice, 0, 0);
  enchLoaded.restore(enchSaved);
  check((enchLoaded.enchantByItem["novice_knife"]?.length ?? 0) === 3, "enchant: restored from save");

  // ---- deterministic Aesir runes ----
  const runer = new Player(982, 1, "Runer", JobId.Swordsman, 0, 0);
  const baseStrR = runer.stats.str;
  check(!runer.unlockRune("might1"), "runes: cannot unlock without points");
  runer.runePoints = 5;
  check(!runer.unlockRune("might2"), "runes: prerequisite enforced");
  check(runer.unlockRune("might1"), "runes: unlock first node");
  check(runer.runePoints === 4, "runes: cost deducted");
  check(runer.unlockRune("might2"), "runes: unlock next node after prereq");
  // might1 = STR +3 -> effective str via derived (atk reflects it); check str-derived bonus applied
  check(runer.runes.includes("might1") && runer.runes.includes("might2"), "runes: tracked as unlocked");
  check(runer.stats.str === baseStrR, "runes: base stats unchanged (bonus is derived-only)");

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

  // ---- deterministic pets ----
  const tamer = new Player(986, 1, "Tamer", JobId.Swordsman, 0, 0);
  const baseLuk = tamer.stats.luk;
  tamer.addItem("poring_egg", 1);
  check(tamer.useItem("poring_egg"), "pet: using an egg summons a pet");
  check(tamer.activePet === "poring_pet", "pet: active pet is set");
  check(tamer.toSelfState().pet === "poring_pet", "pet: surfaced in self state");
  // pet grants LUK +3 -> crit (derived from luk) should be at least as high as before
  check(tamer.stats.luk === baseLuk, "pet: base stats unchanged (bonus is derived-only)");

  // ---- deterministic mount (reusable whistle toggles) ----
  const rider = new Player(985, 1, "Rider", JobId.Swordsman, 0, 0);
  rider.addItem("peco_whistle", 1);
  check(rider.useItem("peco_whistle") && rider.activeMountId === "peco", "mount: whistle mounts the rider on Peco Peco");
  check((rider.inventory["peco_whistle"] ?? 0) === 1, "mount: whistle is reusable (not consumed)");
  check(rider.useItem("peco_whistle") && rider.activeMountId === null, "mount: whistle toggles dismount");

  // ---- mount collection: distinct mounts, stat bonus, direct switching ----
  const baseAgi = rider.stats.agi;
  rider.addItem("dune_wolf_whistle", 1);
  check(rider.useItem("dune_wolf_whistle") && rider.activeMountId === "dune_wolf", "mount: Dune Wolf whistle mounts a different mount");
  check(rider.derived.atk > 0 && rider.stats.agi === baseAgi, "mount: Dune Wolf's AGI bonus is derived-only");
  rider.addItem("baby_dragon_whistle", 1);
  check(rider.useItem("baby_dragon_whistle") && rider.activeMountId === "baby_dragon", "mount: summoning a different mount switches directly");
  check(rider.useItem("baby_dragon_whistle") && rider.activeMountId === null, "mount: re-using the active mount's whistle dismounts");

  // ---- costumes: purely cosmetic, no stat effect ----
  const dresser = new Player(964, 1, "Dresser", JobId.Mage, 0, 0);
  const baseAtkD = dresser.derived.atk;
  const baseStatsD = { ...dresser.stats };
  dresser.addItem("crimson_duelist_ticket", 1);
  check(dresser.useItem("crimson_duelist_ticket") && dresser.activeCostumeId === "crimson_duelist", "costume: ticket wears the outfit");
  check((dresser.inventory["crimson_duelist_ticket"] ?? 0) === 1, "costume: ticket is reusable (not consumed)");
  check(dresser.derived.atk === baseAtkD, "costume: no effect on derived stats");
  check(JSON.stringify(dresser.stats) === JSON.stringify(baseStatsD), "costume: no effect on base stats");
  dresser.addItem("azure_mystic_ticket", 1);
  check(dresser.useItem("azure_mystic_ticket") && dresser.activeCostumeId === "azure_mystic", "costume: wearing a different outfit switches directly");
  check(dresser.useItem("azure_mystic_ticket") && dresser.activeCostumeId === null, "costume: re-using the worn outfit's ticket removes it");
  check(dresser.toSelfState().costumeId === null, "costume: surfaced in self state");

  // ---- guild depth: leveling (EXP bonus) + shared storage ----
  const guildWorld = new World();
  const master = new Player(958, 1, "Master", JobId.Swordsman, 0, 0);
  const recruit = new Player(957, 1, "Recruit", JobId.Swordsman, 0, 0);
  guildWorld.players.set(master.id, master);
  guildWorld.players.set(recruit.id, recruit);
  guildWorld.guild.create(master, "Testament");
  guildWorld.guild.join(recruit, "Testament");
  check(master.guildId != null && master.guildId === recruit.guildId, "guild: master and recruit share a guild");
  check(guildWorld.guild.expMultiplier(master.guildId) === 1, "guild: no EXP bonus at level 1");
  guildWorld.guild.addExp(master.guildId, guildXpToNext(1));
  check(guildWorld.guild.expMultiplier(master.guildId) > 1, "guild: leveling up grants an EXP bonus");
  check(guildWorld.guild.expMultiplier(recruit.guildId) === guildWorld.guild.expMultiplier(master.guildId), "guild: the EXP bonus applies to every member");

  master.addItem("red_potion", 3);
  check(guildWorld.guild.storeItem(master, "red_potion", 2), "guild storage: member deposits an item");
  check(master.countItem("red_potion") === 1, "guild storage: deposited items leave the member's bag");
  check(!guildWorld.guild.retrieveItem(recruit, "red_potion", 3), "guild storage: cannot withdraw more than is banked");
  check(guildWorld.guild.retrieveItem(recruit, "red_potion", 2), "guild storage: a different member withdraws the shared item");
  check(recruit.countItem("red_potion") === 2, "guild storage: withdrawn items land in the withdrawer's own bag");
  check(!guildWorld.guild.storeItem(master, "red_potion", 5), "guild storage: cannot deposit more than the member owns");

  // ---- structured PvP: duel requests ----
  const duelWorld = new World();
  const challenger = new Player(951, 1, "Challenger", JobId.Swordsman, 0, 0);
  const defender = new Player(950, 1, "Defender", JobId.Swordsman, 0, 0);
  const distant = new Player(949, 1, "Distant", JobId.Mage, 0, 0);
  distant.mapId = "geffen";
  duelWorld.players.set(challenger.id, challenger);
  duelWorld.players.set(defender.id, defender);
  duelWorld.players.set(distant.id, distant);

  check(duelWorld.duel.opponentOf(challenger.id) === null, "duel: no opponent before any request");
  duelWorld.duel.request(challenger, distant.id);
  duelWorld.duel.accept(distant, challenger.id);
  check(duelWorld.duel.opponentOf(challenger.id) === null, "duel: cannot duel a player on a different map");

  duelWorld.duel.request(challenger, defender.id);
  duelWorld.duel.accept(defender, challenger.id);
  check(duelWorld.duel.opponentOf(challenger.id) === defender.id, "duel: accepting pairs the challenger with the defender");
  check(duelWorld.duel.opponentOf(defender.id) === challenger.id, "duel: the pairing is mutual");

  duelWorld.duel.request(challenger, distant.id); // already dueling — should be ignored
  check(duelWorld.duel.opponentOf(distant.id) === null, "duel: an active duelist cannot also challenge a third player");

  duelWorld.duel.leave(challenger); // forfeit
  check(duelWorld.duel.opponentOf(challenger.id) === null, "duel: forfeiting clears the challenger's own state");
  check(duelWorld.duel.opponentOf(defender.id) === null, "duel: forfeiting also clears the opponent's state");

  const decliner = new Player(948, 1, "Decliner", JobId.Swordsman, 0, 0);
  duelWorld.players.set(decliner.id, decliner);
  duelWorld.duel.request(defender, decliner.id);
  duelWorld.duel.decline(decliner, defender.id);
  duelWorld.duel.accept(decliner, defender.id); // the request was declined — accepting late should fail
  check(duelWorld.duel.opponentOf(defender.id) === null, "duel: a declined request cannot later be accepted");

  duelWorld.duel.request(defender, decliner.id);
  duelWorld.duel.accept(decliner, defender.id);
  check(duelWorld.duel.opponentOf(defender.id) === decliner.id, "duel: a fresh request after a decline succeeds normally");

  // ---- life skills: gathering yield tables ----
  check(rollGather("fishing", 1, () => 0) === "sardine", "gather: lowest-level roll picks the common yield");
  check(rollGather("fishing", 1, () => 0.999) === "sardine", "gather: only the unlocked yield can appear below its tier's level");
  check(rollGather("fishing", 5, () => 0.999) === "tuna", "gather: leveling up unlocks a rarer yield");
  check(rollGather("fishing", 20, () => 0.999) === "golden_carp", "gather: high level + high roll reaches the rarest yield");
  check(isFinite(lifeSkillXpToNext(1)) && lifeSkillXpToNext(1) > 0, "gather: EXP-to-next is a positive number below the cap");
  check(!isFinite(lifeSkillXpToNext(30)), "gather: no EXP needed once a life skill is maxed");

  // ---- life skills: Player.gather() cooldown, leveling, yields ----
  const gatherer = new Player(947, 1, "Gatherer", JobId.Merchant, 0, 0);
  check(gatherer.lifeSkillLevel("gardening") === 1, "gather: a fresh player starts every life skill at level 1");
  const firstGather = gatherer.gather("gardening", () => 0);
  check(firstGather?.itemId === "turnip" && gatherer.countItem("turnip") === 1, "gather: a successful gather adds the rolled item to the bag");
  check(gatherer.gather("gardening", () => 0) === null, "gather: gathering again immediately is blocked by the shared cooldown");
  let gathers = 1;
  while (gatherer.lifeSkillLevel("gardening") === 1 && gathers < 20) {
    gatherer.lastGatherAt = 0; // bypass the real-time cooldown for a fast, deterministic test
    gatherer.gather("gardening", () => 0);
    gathers++;
  }
  check(gatherer.lifeSkillLevel("gardening") === 2, "gather: enough successful gathers level up the life skill");
  check(gatherer.toSelfState().lifeSkills.find((s) => s.id === "gardening")?.level === 2, "gather: life skill level is surfaced in self state");

  // ---- life skills: crafting ----
  const cook = new Player(946, 1, "Cook", JobId.Merchant, 0, 0);
  cook.addItem("sardine", 3);
  const crafted = cook.craft("grilled_sardine_recipe");
  check(crafted?.itemId === "grilled_sardine" && cook.countItem("grilled_sardine") === 1, "craft: a fulfilled recipe consumes inputs and grants the output");
  check(cook.countItem("sardine") === 0, "craft: recipe inputs are fully consumed");
  check(cook.craft("grilled_sardine_recipe") === null, "craft: cannot craft again without enough ingredients");
  check(cook.countItem("grilled_sardine") === 1, "craft: a failed craft attempt doesn't partially consume anything");
  check(cook.craft("not_a_real_recipe") === null, "craft: an unknown recipe id fails cleanly");
  check((cook.lifeSkillExp["cooking"] ?? 0) > 0, "craft: a successful craft grants Cooking EXP");
  check(cook.toSelfState().lifeSkills.some((s) => s.id === "smelting"), "craft: Smelting is surfaced in self state");
  check(cook.toSelfState().lifeSkills.some((s) => s.id === "crafting"), "craft: Crafting is surfaced in self state");

  // ---- life skills: smelting -> crafting production chain ----
  const forger = new Player(938, 1, "Smith", JobId.Swordsman, 0, 0);
  forger.addItem("oridecon", 4);
  forger.addItem("elunium", 2);
  check(forger.craft("oridecon_ingot_recipe")?.itemId === "oridecon_ingot", "smelt: ore smelts into an ingot");
  check(forger.craft("oridecon_ingot_recipe")?.itemId === "oridecon_ingot", "smelt: second bar poured");
  check(forger.craft("elunium_ingot_recipe")?.itemId === "elunium_ingot", "smelt: elunium smelts too");
  check(forger.countItem("oridecon") === 0 && forger.countItem("oridecon_ingot") === 2, "smelt: ores consumed, ingots banked");
  check((forger.lifeSkillExp["smelting"] ?? 0) > 0, "smelt: smelting grants Smelting EXP");
  const band = forger.craft("miners_band_recipe");
  check(band?.itemId === "miners_band" && forger.countItem("miners_band") === 1, "craft chain: ingots craft into equipment");
  check(forger.countItem("oridecon_ingot") === 0 && forger.countItem("elunium_ingot") === 0, "craft chain: ingots consumed");
  check(forger.equip("miners_band"), "craft chain: crafted accessory is equippable");
  forger.addItem("mithril_ore", 2);
  check(forger.craft("mithril_ingot_recipe") === null, "smelt: a master recipe is gated below its skill level");
  forger.lifeSkillLevels["smelting"] = 10;
  check(forger.craft("mithril_ingot_recipe")?.itemId === "mithril_ingot", "smelt: the gate opens at the required level");

  // ---- life skills: gathering stamina ----
  const miner = new Player(937, 1, "Miner", JobId.Merchant, 0, 0);
  check(miner.toSelfState().stamina === STAMINA_MAX, "stamina: a fresh player starts at full stamina");
  miner.gather("mining", () => 0);
  check(miner.stamina === STAMINA_MAX - GATHER_STAMINA_COST, "stamina: each gather costs a slice");
  miner.stamina = GATHER_STAMINA_COST - 1;
  miner.lastGatherAt = 0;
  check(miner.gather("mining", () => 0) === null, "stamina: gathering is blocked when exhausted");
  check(miner.regenStamina(Date.now() + STAMINA_REGEN_MS * 2 + 50) >= GATHER_STAMINA_COST, "stamina: the pool trickles back over time");
  miner.lastGatherAt = 0;
  check(miner.gather("mining", () => 0) !== null, "stamina: gathering works again after regen");

  // ---- Endless Tower: party-scoped instanced dungeon ----
  const tw = new World();
  const towerMsgs: ServerMessage[] = [];
  const towerLink = { id: 9001, playerId: null as number | null, send: (m: ServerMessage) => towerMsgs.push(m) };
  tw.addConnection(towerLink as never);
  const climber = new Player(tw.allocId(), towerLink.id, "Climber", JobId.Knight, 0, 0);
  towerLink.playerId = climber.id;
  tw.addPlayer(climber);
  check(!tw.instances.enter(climber).ok, "tower: entry blocked below the level gate");
  climber.level = 40;
  climber.zeny = 0;
  check(!tw.instances.enter(climber).ok, "tower: entry blocked without the Zeny fee");
  climber.zeny = 5000;
  check(tw.instances.enter(climber).ok, "tower: a leveled player with the fee may enter");
  check(climber.zeny === 5000 - TOWER_ENTRY_ZENY, "tower: the entry fee is deducted");
  const instMapId = climber.mapId;
  check(instMapId.startsWith("tower_"), "tower: entry moves the player onto a private instance map");
  check(!!MAPS[instMapId], "tower: the instance map registers itself while open");
  check(tw.instances.floorOf(instMapId) === 1, "tower: the climb starts on floor 1");
  const floor1 = [...tw.monsters.values()].filter((m) => m.mapId === instMapId);
  check(floor1.length === 4, "tower: floor 1 spawns a wave of monsters");
  check(floor1.every((m) => m.temporary), "tower: tower monsters are one-shot spawns (no respawn)");
  check([...tw.npcs.values()].some((n) => n.mapId === instMapId && n.role === "portal"), "tower: an exit portal waits inside");
  check(towerMsgs.some((m) => m.t === MsgType.TowerUpdate && m.floor === 1 && m.remaining === 4), "tower: the floor status is pushed to climbers");
  const zenyBefore = climber.zeny;
  const clearFloor = () => {
    for (const m of [...tw.monsters.values()].filter((x) => x.mapId === instMapId && !x.isDead)) {
      m.hp = 0;
      m.aiState = MonsterAIState.Dead;
      tw.instances.onMonsterSlain(m);
    }
  };
  clearFloor();
  check(tw.instances.floorOf(instMapId) === 2, "tower: clearing every monster advances the floor");
  check(climber.zeny > zenyBefore, "tower: a cleared floor pays out Zeny");
  check([...tw.monsters.values()].some((m) => m.mapId === instMapId && !m.isDead), "tower: the next floor spawns immediately");
  while (tw.instances.floorOf(instMapId) < 5) clearFloor();
  check([...tw.monsters.values()].some((m) => m.mapId === instMapId && !m.isDead && m.template.boss), "tower: every 5th floor spawns a boss capstone");
  const oreBefore = climber.countItem("oridecon");
  clearFloor();
  check(tw.instances.floorOf(instMapId) === 6, "tower: boss floors advance like any other once cleared");
  check(climber.countItem("oridecon") > oreBefore, "tower: boss floors pay a refine-ore bonus");
  tw.travelPlayer(climber, { toMap: "field", toX: 0, toZ: 0 });
  check(!MAPS[instMapId], "tower: the instance unregisters when its last climber leaves");
  check([...tw.monsters.values()].every((m) => m.mapId !== instMapId), "tower: instance monsters are swept on teardown");
  check([...tw.npcs.values()].every((n) => n.mapId !== instMapId), "tower: the exit portal is swept on teardown");

  // ---- War of Emperium: guild siege ----
  check(MONSTER_TEMPLATES.emperium?.passive === true, "siege: the Emperium is a passive objective");
  check((MONSTER_TEMPLATES.emperium?.baseHp ?? 0) >= 50000, "siege: the Emperium has a heavy HP pool");
  const sg = new World();
  const sgMsgs: ServerMessage[] = [];
  const sgLink = { id: 9100, playerId: null as number | null, send: (m: ServerMessage) => sgMsgs.push(m) };
  sg.addConnection(sgLink as never);
  const warlord = new Player(sg.allocId(), sgLink.id, "Master", JobId.Knight, 0, 0);
  sgLink.playerId = warlord.id;
  sg.addPlayer(warlord);
  check(!sg.siege.enter(warlord).ok, "siege: entry blocked below the castle level gate");
  warlord.level = 40;
  check(!sg.siege.declare(warlord).ok, "siege: a guildless player cannot declare war");
  sg.guild.create(warlord, "Valkyries");
  check(warlord.guildId != null, "siege: warlord formed a guild");
  check(sg.siege.enter(warlord).ok, "siege: a leveled player may approach the castle");
  check(warlord.mapId === "valkyrie_castle", "siege: entry warps to the castle");
  check(!sg.isPvp("valkyrie_castle"), "siege: the castle is peaceful outside a siege window");
  check(sg.siege.declare(warlord).ok, "siege: a guild may declare a siege");
  check(sg.isPvp("valkyrie_castle"), "siege: the castle turns PvP during a siege window");
  const emperium = [...sg.monsters.values()].find((m) => m.template.id === "emperium");
  check(!!emperium, "siege: declaring a siege raises the Emperium");
  check(sg.siege.isEmperium(emperium!.id), "siege: the siege system recognises its Emperium");
  check(!sg.siege.declare(warlord).ok, "siege: cannot declare a second siege while one runs");
  check(sgMsgs.some((m) => m.t === MsgType.SiegeUpdate && m.active), "siege: an active siege status is pushed to the castle");
  const warlordZenyBefore = warlord.zeny;
  sg.siege.onEmperiumBroken(warlord);
  check(sg.siege.ownerGuildId === warlord.guildId, "siege: breaking the Emperium claims the castle for the breaker's guild");
  check(sg.guild.getById(warlord.guildId)?.ownedCastle === "Valkyrie Castle", "siege: the holding guild records the castle it owns");
  check(warlord.countItem("emperium_fragment") >= 3, "siege: the conquering guild is paid in Emperium Fragments");
  check(warlord.zeny > warlordZenyBefore, "siege: the conquest also pays Zeny");
  check(![...sg.monsters.values()].some((m) => m.template.id === "emperium"), "siege: the Emperium is removed once broken");
  check(!sg.isPvp("valkyrie_castle"), "siege: PvP closes when the siege ends");
  check(sg.guild.expMultiplier(warlord.guildId) > 1, "siege: holding a castle grants a guild-wide EXP edge");
  const heldZeny = warlord.zeny;
  sg.siege.update(SIEGE_REWARD_INTERVAL_MS);
  check(warlord.zeny > heldZeny, "siege: the holding guild draws a recurring occupancy payout");
  // A siege that runs out of time is repelled — the Emperium falls and the
  // current holder keeps the castle.
  sg.siege.startSiege();
  check([...sg.monsters.values()].some((m) => m.template.id === "emperium"), "siege: a new window raises a fresh Emperium");
  sg.siege.update(SIEGE_WINDOW_MS + 1);
  check(!sg.isPvp("valkyrie_castle"), "siege: an expired window closes PvP");
  check(![...sg.monsters.values()].some((m) => m.template.id === "emperium"), "siege: a repelled siege removes the Emperium");
  check(sg.siege.ownerGuildId === warlord.guildId, "siege: a repelled siege leaves ownership unchanged");

  // ---- day/night + weather environment ----
  check(daylight(0.5) > 0.9, "env: noon is bright");
  check(daylight(0.0) < 0.1, "env: midnight is dark");
  check(isNight(0.95) && isNight(0.1) && !isNight(0.5), "env: night before dawn / after dusk");
  check(environmentMultiplier(Element.Shadow, 0.0, Weather.Clear) > 1, "env: Shadow amplified at night");
  check(environmentMultiplier(Element.Holy, 0.5, Weather.Clear) > 1, "env: Holy amplified by day");
  check(
    environmentMultiplier(Element.Water, 0.5, Weather.Rain) > environmentMultiplier(Element.Water, 0.5, Weather.Clear),
    "env: Water surges in the rain",
  );
  check(environmentMultiplier(Element.Fire, 0.5, Weather.Storm) < 1, "env: Fire dampened in a storm");
  check(environmentMultiplier(Element.Neutral, 0.5, Weather.Clear) === 1, "env: Neutral unaffected on a clear day");
  check(rollWeather(() => 0) === Weather.Clear, "env: rollWeather is deterministic (Clear at r=0)");

  // ---- world bosses (shared HP + contribution tracking) ----
  const wbT = MONSTER_TEMPLATES["lion_city_colossus"];
  check(!!wbT?.worldBoss && !!wbT?.boss, "worldboss: Colossus flagged worldBoss + boss");
  check((wbT?.baseHp ?? 0) >= 500000, "worldboss: huge shared HP pool");
  check(!!MONSTER_TEMPLATES["tide_emperor"]?.worldBoss, "worldboss: Tide Emperor is a world boss");
  check(!!MAPS["the_float"], "worldboss: The Float raid map exists");
  // ---- Celestial Spire endgame content ----
  check(!!MAPS["celestial_spire"], "content: Celestial Spire map exists");
  check(!!MONSTER_TEMPLATES["aether_sovereign"]?.worldBoss, "content: Aether Sovereign is a world boss");
  check((MONSTER_TEMPLATES["aether_sovereign"]?.mechanics?.length ?? 0) >= 3, "content: Aether Sovereign has multiple mechanics");
  check(MAPS["the_float"].npcs.some((n) => n.dest?.toMap === "celestial_spire"), "content: The Float links to the Spire");
  const raidBoss = new Monster(4242, MONSTER_TEMPLATES["lion_city_colossus"], "z", "the_float", 0, 0);
  raidBoss.recordDamage(1, 500);
  raidBoss.recordDamage(2, 300);
  raidBoss.recordDamage(1, 200);
  check(
    raidBoss.damageByPlayer.get(1) === 700 && raidBoss.damageByPlayer.get(2) === 300,
    "worldboss: per-player damage tallied for shared HP",
  );

  // ---- mythic equipment tier ----
  check(tierOf(getItem("aegis_of_temasek")!) === 6, "tier: mythic weapon is tier 6");
  check(rarityOf(getItem("mythic_warplate")!) === "mythic", "tier: mythic armor rarity");
  check(TIER_NAME[6] === "Mythic", "tier: tier 6 is named Mythic");
  check(tierOf(getItem("red_potion")!) >= 1, "tier: items resolve to a valid tier");

  // ---- deterministic Exchange Centre (player marketplace) ----
  const exWorld: any = { players: new Map(), connections: new Map(), broadcast() {} };
  const ex = new ExchangeSystem(exWorld);
  const exSeller = new Player(960, 1, "Seller", JobId.Swordsman, 0, 0);
  const exBuyer = new Player(961, 2, "Buyer", JobId.Mage, 0, 0);
  exWorld.players.set(exSeller.id, exSeller);
  exWorld.players.set(exBuyer.id, exBuyer);
  exSeller.addItem("red_potion", 5);
  exBuyer.zeny = 1000;
  check(ex.list(exSeller, "red_potion", 3, 100), "exchange: seller lists items for sale");
  check(exSeller.countItem("red_potion") === 2, "exchange: listed items escrowed from the bag");
  check(ex.snapshot().length === 1, "exchange: listing appears on the market");
  const exListing = ex.snapshot()[0];
  check(!ex.buy(exSeller, exListing.id, 1), "exchange: cannot buy your own listing");
  check(ex.buy(exBuyer, exListing.id, 2), "exchange: buyer purchases 2 units");
  check(exBuyer.countItem("red_potion") === 2, "exchange: buyer receives the goods");
  check(exBuyer.zeny === 800, "exchange: buyer charged unit price × qty");
  check(exSeller.zeny === Math.floor(200 * 0.95), "exchange: seller paid proceeds minus 5% tax");
  check(ex.snapshot()[0]?.qty === 1, "exchange: partial buy decrements remaining stock");
  check(ex.cancel(exSeller, exListing.id), "exchange: seller cancels remaining listing");
  check(exSeller.countItem("red_potion") === 3, "exchange: cancel returns escrowed items");
  check(ex.snapshot().length === 0, "exchange: market empty after cancel");
  check(!ex.list(exSeller, "red_potion", 99, 100), "exchange: cannot list more than you own");
  check(!ex.list(exSeller, "red_potion", 1, 0), "exchange: price must be positive");

  // ---- class-restricted equipment ----
  check(itemEquippableBy(getItem("vanguard_greatsword")!, JobId.Swordsman), "class: sword gear fits a Swordsman");
  check(itemEquippableBy(getItem("vanguard_greatsword")!, JobId.DragonKnight), "class: sword line gear fits a Dragon Knight");
  check(!itemEquippableBy(getItem("vanguard_greatsword")!, JobId.Mage), "class: a Mage cannot use sword gear");
  check(itemEquippableBy(getItem("red_potion")!, JobId.Mage), "class: unrestricted items fit any job");
  const swd = new Player(940, 1, "Swordy", JobId.Swordsman, 0, 0);
  swd.addItem("vanguard_greatsword", 1);
  check(swd.equip("vanguard_greatsword"), "class: Swordsman equips the Vanguard Greatsword");
  const wiz2 = new Player(941, 2, "Wiz", JobId.Mage, 0, 0);
  wiz2.addItem("vanguard_greatsword", 1);
  check(!wiz2.equip("vanguard_greatsword"), "class: Mage is blocked from sword gear");
  check((wiz2.inventory["vanguard_greatsword"] ?? 0) === 1, "class: a blocked equip leaves the item in the bag");
  wiz2.addItem("archmage_rod", 1);
  check(wiz2.equip("archmage_rod"), "class: Mage equips the Archmage Rod");

  // ---- skill cast times scale with DEX ----
  check(effectiveCastMs(getSkill("fire_bolt")!, 0) === 600, "cast: fire bolt base cast time at 0 DEX");
  check(effectiveCastMs(getSkill("bash")!, 0) === 0, "cast: melee skills are instant");
  check(effectiveCastMs(getSkill("fire_bolt")!, 60) < 600, "cast: DEX shortens cast time");
  check(effectiveCastMs(getSkill("fire_bolt")!, 600) === Math.round(600 * 0.25), "cast: cast time floors at 25%");

  // ---- skill leveling deepens cooldown + crowd-control duration ----
  const bashCd = getSkill("bash")!.cooldownMs;
  check(skillCooldownMs(getSkill("bash")!, 1) === bashCd, "skill-lvl: cooldown unchanged at level 1");
  check(skillCooldownMs(getSkill("bash")!, 5) < bashCd, "skill-lvl: higher level shortens cooldown");
  check(skillCooldownMs(getSkill("bash")!, 99) >= Math.round(bashCd * 0.7), "skill-lvl: cooldown cut floors at 30%");
  check(skillEffectDurationMs(2000, 1) === 2000, "skill-lvl: CC duration base at level 1");
  check(skillEffectDurationMs(2000, 5) > 2000, "skill-lvl: higher level lengthens CC");

  // ---- after-cast delay shortened by AGI ----
  check(afterCastDelayMs(0) === 420, "acd: base after-cast delay at 0 AGI");
  check(afterCastDelayMs(60) < 420, "acd: AGI shortens the after-cast delay");
  check(afterCastDelayMs(999) === 120, "acd: after-cast delay floors at 120ms");

  // ---- distance LOD tiers ----
  check(lodTier(10 * 10) === "full", "lod: near entity is full detail");
  check(lodTier(100 * 100) === "frozen", "lod: mid-distance entity freezes animation");
  check(lodTier(200 * 200) === "culled", "lod: far entity is culled");
  check(labelVisible(30 * 30) && !labelVisible(80 * 80), "lod: nameplate hidden past the label range");

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
