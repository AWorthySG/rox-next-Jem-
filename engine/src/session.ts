import {
  EquipSlot,
  JobId,
  MAP_SIZE,
  MsgType,
  SNAPSHOT_RATE,
  TICK_RATE,
  type ClientMessage,
} from "@rox/shared";
import type { World } from "./World.js";
import type { ClientLink } from "./ClientLink.js";
import { Player } from "./Player.js";

const VALID_JOBS = new Set<string>([JobId.Novice, JobId.Swordsman, JobId.Mage]);

// Applies a decoded client message to the world for a given client link. Shared
// by the WS gateway and the in-browser local server so routing never diverges.
export function handleClientMessage(world: World, link: ClientLink, msg: ClientMessage): void {
  switch (msg.t) {
    case MsgType.Join:
      handleJoin(world, link, msg.name, msg.job);
      break;
    case MsgType.MoveIntent: {
      const p = playerOf(world, link);
      if (p && isFinite(msg.x) && isFinite(msg.z)) {
        p.moveTarget = { x: clampMap(msg.x), z: clampMap(msg.z) };
        p.attackTargetId = null;
      }
      break;
    }
    case MsgType.AttackIntent: {
      const p = playerOf(world, link);
      if (p && world.monsters.has(msg.targetId)) {
        p.attackTargetId = msg.targetId;
      }
      break;
    }
    case MsgType.SkillIntent: {
      const p = playerOf(world, link);
      if (p) {
        p.pendingSkillId = msg.skillId;
        p.pendingSkillTargetId = msg.targetId;
        p.attackTargetId = null; // skill supersedes the current auto-attack
      }
      break;
    }
    case MsgType.JobAdvance: {
      const p = playerOf(world, link);
      if (p && p.advanceJob(msg.targetJob)) {
        // Re-announce the player so everyone sees the new job.
        world.broadcast({ t: MsgType.Spawn, entity: p.toFull() });
      }
      break;
    }
    case MsgType.UseItem: {
      const p = playerOf(world, link);
      if (p) p.useItem(msg.itemId);
      break;
    }
    case MsgType.Equip: {
      const p = playerOf(world, link);
      if (p) p.equip(msg.itemId);
      break;
    }
    case MsgType.Unequip: {
      const p = playerOf(world, link);
      if (p && isEquipSlot(msg.slot)) p.unequip(msg.slot);
      break;
    }
    case MsgType.Chat: {
      const p = playerOf(world, link);
      const text = (msg.text ?? "").toString().slice(0, 140).trim();
      if (p && text) {
        world.broadcast({ t: MsgType.ChatBroadcast, fromId: p.id, name: p.name, text });
      }
      break;
    }
    case MsgType.Ping:
      link.send({ t: MsgType.Pong, clientTime: msg.clientTime, serverTime: Date.now() });
      break;
  }
}

function handleJoin(world: World, link: ClientLink, rawName: string, rawJob?: JobId): void {
  if (link.playerId != null) return;
  const name = sanitizeName(rawName);
  const job = rawJob && VALID_JOBS.has(rawJob) ? rawJob : JobId.Novice;

  const x = (Math.random() - 0.5) * 6;
  const z = (Math.random() - 0.5) * 6;
  const player = new Player(world.allocId(), link.id, name, job, x, z);
  link.playerId = player.id;

  link.send({
    t: MsgType.JoinAck,
    selfId: player.id,
    tickRate: TICK_RATE,
    snapshotRate: SNAPSHOT_RATE,
    mapSize: MAP_SIZE,
    self: player.toSelfState(),
  });
  // Existing world to the joiner first, then announce the joiner to everyone.
  world.spawnAllFor(link);
  world.addPlayer(player);
}

function playerOf(world: World, link: ClientLink): Player | null {
  if (link.playerId == null) return null;
  return world.players.get(link.playerId) ?? null;
}

export function sanitizeName(raw: string): string {
  const cleaned = (raw ?? "").toString().replace(/[^\w \-]/g, "").trim().slice(0, 16);
  return cleaned || `Adventurer${Math.floor(Math.random() * 1000)}`;
}

function isEquipSlot(s: string): s is EquipSlot {
  return s === EquipSlot.Weapon || s === EquipSlot.Armor || s === EquipSlot.Accessory;
}

function clampMap(v: number): number {
  const half = MAP_SIZE / 2;
  return Math.min(half, Math.max(-half, v));
}
