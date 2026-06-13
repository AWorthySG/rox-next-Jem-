import { EntityKind, type EntityFull } from "@rox/shared";

export interface PortalDest {
  toMap: string;
  toX: number;
  toZ: number;
}

// A static, non-combat town/dungeon NPC: shopkeeper, guide, blacksmith, or a
// portal. NPCs never move and are sent once on (map) spawn.
export class Npc {
  mapId = "field";
  constructor(
    readonly id: number,
    readonly name: string,
    readonly role: string,
    readonly x: number,
    readonly z: number,
    readonly facing = 0,
    readonly dest?: PortalDest,
  ) {}

  toFull(): EntityFull {
    return {
      id: this.id,
      kind: EntityKind.Npc,
      name: this.name,
      x: this.x,
      z: this.z,
      facing: this.facing,
      hp: 1,
      maxHp: 1,
      level: 0,
      npcRole: this.role,
    };
  }
}

export interface NpcSpawn {
  name: string;
  role: string;
  x: number;
  z: number;
  facing?: number;
  dest?: PortalDest;
}
