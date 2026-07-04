import {
  EquipSlot,
  getItem,
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
import { MAPS, START_MAP } from "./data/maps.js";

const VALID_JOBS = new Set<string>([
  JobId.Novice,
  JobId.Swordsman,
  JobId.Mage,
  JobId.Archer,
  JobId.Acolyte,
  JobId.Thief,
  JobId.Merchant,
]);

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
      } else if (p && world.isPvp(p.mapId)) {
        const other = world.players.get(msg.targetId);
        if (other && other.id !== p.id && other.mapId === p.mapId) p.attackTargetId = msg.targetId;
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
      const item = getItem(msg.itemId);
      if (p && p.useItem(msg.itemId) && (item?.mount || item?.costume)) {
        // Mounting/dismounting or changing costume changes how the player
        // looks to everyone else.
        world.broadcastToMap(p.mapId, { t: MsgType.Spawn, entity: p.toFull() });
      }
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
    case MsgType.BuyItem: {
      const p = playerOf(world, link);
      if (p) p.buy(msg.itemId, Math.max(1, Math.min(99, Math.floor(msg.qty || 1))));
      break;
    }
    case MsgType.SellItem: {
      const p = playerOf(world, link);
      if (p) p.sell(msg.itemId, Math.max(1, Math.min(99, Math.floor(msg.qty || 1))));
      break;
    }
    case MsgType.StoreItem: {
      const p = playerOf(world, link);
      if (p) p.storeItem(msg.itemId, Math.max(1, Math.min(999, Math.floor(msg.qty || 1))));
      break;
    }
    case MsgType.RetrieveItem: {
      const p = playerOf(world, link);
      if (p) p.retrieveItem(msg.itemId, Math.max(1, Math.min(999, Math.floor(msg.qty || 1))));
      break;
    }
    case MsgType.PartyInvite: {
      const p = playerOf(world, link);
      if (p) {
        const invite = world.party.invite(p, msg.targetId);
        const target = world.players.get(msg.targetId);
        if (invite && target) {
          world.connections.get(target.connId)?.send({
            t: MsgType.PartyInviteRecv,
            fromId: p.id,
            fromName: invite.fromName,
            partyId: invite.partyId,
          });
        }
      }
      break;
    }
    case MsgType.PartyAccept: {
      const p = playerOf(world, link);
      if (p) world.party.accept(p, msg.partyId);
      break;
    }
    case MsgType.PartyLeave: {
      const p = playerOf(world, link);
      if (p) world.party.leave(p);
      break;
    }
    case MsgType.CreateGuild: {
      const p = playerOf(world, link);
      if (p) world.guild.create(p, msg.name);
      break;
    }
    case MsgType.JoinGuild: {
      const p = playerOf(world, link);
      if (p) world.guild.join(p, msg.name);
      break;
    }
    case MsgType.LeaveGuild: {
      const p = playerOf(world, link);
      if (p) world.guild.leave(p);
      break;
    }
    case MsgType.GuildStoreItem: {
      const p = playerOf(world, link);
      if (p) world.guild.storeItem(p, msg.itemId, Math.max(1, Math.floor(msg.qty || 1)));
      break;
    }
    case MsgType.GuildRetrieveItem: {
      const p = playerOf(world, link);
      if (p) world.guild.retrieveItem(p, msg.itemId, Math.max(1, Math.floor(msg.qty || 1)));
      break;
    }
    case MsgType.AcceptQuest: {
      const p = playerOf(world, link);
      if (p) p.acceptQuest(msg.questId);
      break;
    }
    case MsgType.AllocateStat: {
      const p = playerOf(world, link);
      if (p) p.allocateStat(msg.stat);
      break;
    }
    case MsgType.LevelSkill: {
      const p = playerOf(world, link);
      if (p) p.levelSkill(msg.skillId);
      break;
    }
    case MsgType.UnlockRune: {
      const p = playerOf(world, link);
      if (p) p.unlockRune(msg.runeId);
      break;
    }
    case MsgType.RefineItem: {
      const p = playerOf(world, link);
      if (p && isEquipSlot(msg.slot)) {
        const res = p.refineEquipped(msg.slot);
        if (res) {
          link.send({
            t: MsgType.RefineResult,
            slot: msg.slot,
            itemName: res.itemName,
            success: res.success,
            level: res.level,
            broke: res.broke,
          });
        }
      }
      break;
    }
    case MsgType.EnchantItem: {
      const p = playerOf(world, link);
      if (p && isEquipSlot(msg.slot)) p.enchantItem(msg.slot);
      break;
    }
    case MsgType.ToggleEnchantLock: {
      const p = playerOf(world, link);
      if (p && isEquipSlot(msg.slot)) p.toggleEnchantLock(msg.slot, msg.index);
      break;
    }
    case MsgType.SocketCard: {
      const p = playerOf(world, link);
      if (p) p.socketCard(msg.cardId);
      break;
    }
    case MsgType.UnsocketCard: {
      const p = playerOf(world, link);
      if (p && isEquipSlot(msg.slot)) p.unsocketCard(msg.slot);
      break;
    }
    case MsgType.EnterPortal: {
      const p = playerOf(world, link);
      const npc = world.npcs.get(msg.npcId);
      if (p && npc && npc.role === "portal" && npc.dest && npc.mapId === p.mapId) {
        if (Math.hypot(p.x - npc.x, p.z - npc.z) <= 6) world.travelPlayer(p, npc.dest);
      }
      break;
    }
    case MsgType.NpcHeal: {
      const p = playerOf(world, link);
      const npc = world.npcs.get(msg.npcId);
      if (p && npc && npc.role === "healer" && npc.mapId === p.mapId) {
        p.hp = p.derived.maxHp;
        p.sp = p.derived.maxSp;
      }
      break;
    }
    case MsgType.Warp: {
      const p = playerOf(world, link);
      const npc = world.npcs.get(msg.npcId);
      const dest = MAPS[msg.mapId];
      if (p && npc && npc.role === "warp" && npc.mapId === p.mapId && dest) {
        world.travelPlayer(p, { toMap: dest.id, toX: dest.spawn.x, toZ: dest.spawn.z });
      }
      break;
    }
    case MsgType.ExchangeBrowse: {
      const p = playerOf(world, link);
      if (p) world.exchange.sendTo(p);
      break;
    }
    case MsgType.ExchangeList: {
      const p = playerOf(world, link);
      if (p) world.exchange.list(p, msg.itemId, Math.floor(msg.qty || 0), Math.floor(msg.unitPrice || 0));
      break;
    }
    case MsgType.ExchangeBuy: {
      const p = playerOf(world, link);
      if (p) world.exchange.buy(p, msg.listingId, Math.max(1, Math.floor(msg.qty || 1)));
      break;
    }
    case MsgType.ExchangeCancel: {
      const p = playerOf(world, link);
      if (p) world.exchange.cancel(p, msg.listingId);
      break;
    }
    case MsgType.ClaimQuest: {
      const p = playerOf(world, link);
      if (p) {
        const result = p.claimQuest(msg.questId);
        if (result?.leveled) {
          world.broadcast({
            t: MsgType.LevelUp,
            id: p.id,
            newLevel: p.level,
            maxHp: p.derived.maxHp,
            maxSp: p.derived.maxSp,
            stats: { ...p.stats },
            expToNext: p.toSelfState().expToNext,
          });
        }
      }
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

  const spawn = MAPS[START_MAP].spawn;
  const x = spawn.x + (Math.random() - 0.5) * 6;
  const z = spawn.z + (Math.random() - 0.5) * 6;
  const player = new Player(world.allocId(), link.id, name, job, x, z);
  player.mapId = START_MAP;
  link.playerId = player.id;

  link.send({
    t: MsgType.JoinAck,
    selfId: player.id,
    tickRate: TICK_RATE,
    snapshotRate: SNAPSHOT_RATE,
    mapSize: MAP_SIZE,
    self: player.toSelfState(),
  });
  // Send the starting map's theme + existing entities, then announce the joiner.
  world.enterCurrentMap(player);
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
  return (
    s === EquipSlot.Weapon ||
    s === EquipSlot.Headgear ||
    s === EquipSlot.Armor ||
    s === EquipSlot.Accessory
  );
}

function clampMap(v: number): number {
  const half = MAP_SIZE / 2;
  return Math.min(half, Math.max(-half, v));
}
