import { MsgType } from "@rox/shared";
import type { World } from "./World.js";
import type { Player } from "./Player.js";
import { Monster } from "./Monster.js";
import { Npc } from "./Npc.js";
import { MONSTER_TEMPLATES, type MonsterTemplate } from "./data/spawns.js";
import { MAPS, type GameMap } from "./data/maps.js";

export const TOWER_MIN_LEVEL = 35;
export const TOWER_ENTRY_ZENY = 1000;
export const TOWER_BOSS_EVERY = 5; // every Nth floor is a boss floor
const TOWER_FLOOR_MONSTERS = 4;
const TOWER_THEME = { ground: 0x8a93b8, fog: 0x2b3050, sky: 0x384070 };

interface TowerInstance {
  mapId: string;
  floor: number;
  aliveIds: Set<number>; // monster ids still standing on the current floor
  exitNpcId: number;
}

// Party-scoped instanced dungeons — the Endless Tower. Each party (or solo
// player) gets its own private map, registered dynamically into MAPS so the
// regular travel/snapshot/AI machinery treats it like any other map. Floors
// spawn waves of monsters drawn from around the floor's target level, with a
// boss capstone every TOWER_BOSS_EVERY floors; clearing a floor pays out and
// spawns the next, without limit. The instance tears down when its last
// occupant leaves.
export class InstanceSystem {
  private readonly towers = new Map<string, TowerInstance>(); // key: instance mapId
  private readonly regulars: MonsterTemplate[];
  private readonly bosses: MonsterTemplate[];

  constructor(private world: World) {
    const all = Object.values(MONSTER_TEMPLATES);
    this.regulars = all.filter((t) => !t.boss && !t.worldBoss).sort((a, b) => a.level - b.level);
    this.bosses = all.filter((t) => t.boss && !t.worldBoss).sort((a, b) => a.level - b.level);
  }

  isInstanceMap(mapId: string): boolean {
    return this.towers.has(mapId);
  }

  floorOf(mapId: string): number {
    return this.towers.get(mapId)?.floor ?? 0;
  }

  // Enter (or rejoin) the Endless Tower. Solo players climb alone; party
  // members share one instance keyed by their party id and join at the
  // party's current floor. The Zeny fee is charged once per instance opening.
  enter(player: Player): { ok: boolean; error?: string } {
    if (player.level < TOWER_MIN_LEVEL) {
      return { ok: false, error: `You must be Lv${TOWER_MIN_LEVEL} to enter the Endless Tower.` };
    }
    const key = player.partyId != null ? `party${player.partyId}` : `solo${player.id}`;
    const mapId = `tower_${key}`;
    let inst = this.towers.get(mapId);
    const isNew = !inst;
    if (!inst) {
      if (player.zeny < TOWER_ENTRY_ZENY) {
        return { ok: false, error: `The Tower Keeper asks ${TOWER_ENTRY_ZENY} Zeny to open the gate.` };
      }
      player.zeny -= TOWER_ENTRY_ZENY;
      inst = this.create(mapId);
    }
    const spawn = MAPS[mapId].spawn;
    this.world.travelPlayer(player, { toMap: mapId, toX: spawn.x, toZ: spawn.z });
    if (isNew) this.spawnFloor(inst);
    else this.sendStatus(inst);
    return { ok: true };
  }

  private create(mapId: string): TowerInstance {
    const map: GameMap = {
      id: mapId,
      name: "Endless Tower",
      theme: TOWER_THEME,
      spawn: { x: 0, z: 16 },
      zones: [],
      npcs: [],
    };
    MAPS[mapId] = map;
    const exit = new Npc(this.world.allocId(), "Tower Exit", "portal", 0, 20, 0, {
      toMap: "field",
      toX: MAPS.field.spawn.x,
      toZ: MAPS.field.spawn.z,
    });
    exit.mapId = mapId;
    this.world.npcs.set(exit.id, exit);
    const inst: TowerInstance = { mapId, floor: 1, aliveIds: new Set(), exitNpcId: exit.id };
    this.towers.set(mapId, inst);
    return inst;
  }

  // Populate floor n: regulars pulled from around the floor's target level so
  // difficulty climbs with height, plus a boss capstone every few floors.
  private spawnFloor(inst: TowerInstance): void {
    const targetLevel = 6 + inst.floor * 3;
    const pool = nearestByLevel(this.regulars, targetLevel, 3);
    for (let i = 0; i < TOWER_FLOOR_MONSTERS; i++) {
      const tmpl = pool[i % pool.length];
      const a = (i / TOWER_FLOOR_MONSTERS) * Math.PI * 2;
      this.spawnTowerMonster(inst, tmpl, Math.cos(a) * 8, -4 + Math.sin(a) * 8);
    }
    if (inst.floor % TOWER_BOSS_EVERY === 0 && this.bosses.length > 0) {
      const boss = nearestByLevel(this.bosses, targetLevel + 4, 1)[0];
      this.spawnTowerMonster(inst, boss, 0, -12);
    }
    this.world.broadcastToMap(inst.mapId, {
      t: MsgType.ChatBroadcast,
      fromId: 0,
      name: "Tower",
      text: `Floor ${inst.floor} — defeat every monster to ascend!`,
    });
    this.sendStatus(inst);
  }

  private spawnTowerMonster(inst: TowerInstance, tmpl: MonsterTemplate, x: number, z: number): void {
    const mon = new Monster(this.world.allocId(), tmpl, "tower", inst.mapId, x, z);
    mon.temporary = true; // tower monsters never respawn
    this.world.monsters.set(mon.id, mon);
    inst.aliveIds.add(mon.id);
    this.world.broadcastToMap(inst.mapId, { t: MsgType.Spawn, entity: mon.toFull() });
  }

  // Called from CombatSystem.slay for every monster death. Advances the floor
  // once the last tower monster on it falls, paying out per climber.
  onMonsterSlain(monster: Monster): void {
    const inst = this.towers.get(monster.mapId);
    if (!inst || !inst.aliveIds.delete(monster.id)) return;
    if (inst.aliveIds.size > 0) {
      this.sendStatus(inst);
      return;
    }
    const zeny = 200 + inst.floor * 100;
    const bossFloor = inst.floor % TOWER_BOSS_EVERY === 0;
    for (const p of this.world.playersOnMap(inst.mapId)) {
      p.zeny += zeny;
      const items: Array<{ id: string; qty: number }> = [];
      if (bossFloor) {
        const qty = Math.max(1, Math.floor(inst.floor / TOWER_BOSS_EVERY));
        p.addItem("oridecon", qty);
        p.addItem("elunium", qty);
        items.push({ id: "oridecon", qty }, { id: "elunium", qty });
      }
      this.world.connections.get(p.connId)?.send({ t: MsgType.Loot, items, zeny });
    }
    this.world.broadcastToMap(inst.mapId, {
      t: MsgType.ChatBroadcast,
      fromId: 0,
      name: "Tower",
      text: `Floor ${inst.floor} cleared! Reward: ${zeny} Zeny${bossFloor ? " + refine ore" : ""}.`,
    });
    inst.floor += 1;
    this.spawnFloor(inst);
  }

  // Tear the instance down once its last occupant leaves (map travel or
  // disconnect) — monsters, exit NPC, dynamic map entry, everything.
  onPlayerLeftMap(mapId: string): void {
    const inst = this.towers.get(mapId);
    if (!inst) return;
    for (const _ of this.world.playersOnMap(mapId)) return; // still occupied
    for (const [id, m] of this.world.monsters) {
      if (m.mapId === mapId) this.world.monsters.delete(id);
    }
    this.world.npcs.delete(inst.exitNpcId);
    this.towers.delete(mapId);
    delete MAPS[mapId];
  }

  private sendStatus(inst: TowerInstance): void {
    this.world.broadcastToMap(inst.mapId, {
      t: MsgType.TowerUpdate,
      floor: inst.floor,
      remaining: inst.aliveIds.size,
    });
  }
}

// The n templates whose level sits closest to the target.
function nearestByLevel(pool: MonsterTemplate[], level: number, n: number): MonsterTemplate[] {
  return [...pool].sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level)).slice(0, n);
}
