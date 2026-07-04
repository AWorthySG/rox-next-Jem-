import { DamageKind, JobId, MsgType } from "./enums.js";
import type { EntityFull, EntitySnapshot, SelfState } from "./entities.js";
import type { Stats } from "./stats.js";
import type { Weather } from "./world.js";

// ---- Client -> Server ----

export interface JoinMsg {
  t: MsgType.Join;
  name: string;
  job?: JobId;
}

export interface MoveIntentMsg {
  t: MsgType.MoveIntent;
  x: number;
  z: number;
}

export interface AttackIntentMsg {
  t: MsgType.AttackIntent;
  targetId: number;
}

export interface SkillIntentMsg {
  t: MsgType.SkillIntent;
  skillId: string;
  targetId: number; // monster target, or own id for self-cast skills
}

export interface JobAdvanceMsg {
  t: MsgType.JobAdvance;
  targetJob: JobId;
}

export interface UseItemMsg {
  t: MsgType.UseItem;
  itemId: string;
}

export interface EquipMsg {
  t: MsgType.Equip;
  itemId: string;
}

export interface UnequipMsg {
  t: MsgType.Unequip;
  slot: string;
}

export interface BuyItemMsg {
  t: MsgType.BuyItem;
  itemId: string;
  qty: number;
}

export interface SellItemMsg {
  t: MsgType.SellItem;
  itemId: string;
  qty: number;
}

export interface StoreItemMsg {
  t: MsgType.StoreItem;
  itemId: string;
  qty: number;
}

export interface RetrieveItemMsg {
  t: MsgType.RetrieveItem;
  itemId: string;
  qty: number;
}

export interface PartyInviteMsg {
  t: MsgType.PartyInvite;
  targetId: number;
}

export interface PartyAcceptMsg {
  t: MsgType.PartyAccept;
  partyId: number;
}

export interface PartyLeaveMsg {
  t: MsgType.PartyLeave;
}

export interface CreateGuildMsg {
  t: MsgType.CreateGuild;
  name: string;
}

export interface JoinGuildMsg {
  t: MsgType.JoinGuild;
  name: string;
}

export interface LeaveGuildMsg {
  t: MsgType.LeaveGuild;
}

export interface GuildStoreItemMsg {
  t: MsgType.GuildStoreItem;
  itemId: string;
  qty: number;
}

export interface GuildRetrieveItemMsg {
  t: MsgType.GuildRetrieveItem;
  itemId: string;
  qty: number;
}

export interface AcceptQuestMsg {
  t: MsgType.AcceptQuest;
  questId: string;
}

export interface ClaimQuestMsg {
  t: MsgType.ClaimQuest;
  questId: string;
}

export interface AllocateStatMsg {
  t: MsgType.AllocateStat;
  stat: string;
}

export interface LevelSkillMsg {
  t: MsgType.LevelSkill;
  skillId: string;
}

export interface UnlockRuneMsg {
  t: MsgType.UnlockRune;
  runeId: string;
}

export interface RefineItemMsg {
  t: MsgType.RefineItem;
  slot: string;
}

export interface EnchantItemMsg {
  t: MsgType.EnchantItem;
  slot: string;
}

export interface ToggleEnchantLockMsg {
  t: MsgType.ToggleEnchantLock;
  slot: string;
  index: number;
}

export interface SocketCardMsg {
  t: MsgType.SocketCard;
  cardId: string;
}

export interface UnsocketCardMsg {
  t: MsgType.UnsocketCard;
  slot: string;
}

export interface EnterPortalMsg {
  t: MsgType.EnterPortal;
  npcId: number;
}

export interface NpcHealMsg {
  t: MsgType.NpcHeal;
  npcId: number;
}

export interface WarpMsg {
  t: MsgType.Warp;
  npcId: number;
  mapId: string;
}

// ---- Exchange Centre (player marketplace) ----

export interface ExchangeBrowseMsg {
  t: MsgType.ExchangeBrowse;
}

export interface ExchangeListMsg {
  t: MsgType.ExchangeList;
  itemId: string;
  qty: number;
  unitPrice: number; // Zeny per unit
}

export interface ExchangeBuyMsg {
  t: MsgType.ExchangeBuy;
  listingId: number;
  qty: number;
}

export interface ExchangeCancelMsg {
  t: MsgType.ExchangeCancel;
  listingId: number;
}

export interface MapTheme {
  ground: number; // hex tint applied to the ground
  fog: number; // hex fog / sky-dome color
  sky: number; // hex sky tint
}

export interface MapChangeMsg {
  t: MsgType.MapChange;
  mapId: string;
  name: string;
  theme: MapTheme;
  pvp: boolean;
  x: number;
  z: number;
}

export interface DefeatedMsg {
  t: MsgType.Defeated;
  byName: string;
}

// Result of a refine attempt, so the client can show success/failure feedback.
export interface RefineResultMsg {
  t: MsgType.RefineResult;
  slot: string;
  itemName: string;
  success: boolean;
  level: number; // resulting refine level
  broke: boolean;
}

// A skill cast has begun (or was cancelled with durationMs 0). Drives the cast
// bar and a wind-up tell; resolution is still server-authoritative.
export interface SkillCastMsg {
  t: MsgType.SkillCast;
  casterId: number;
  skillId: string;
  durationMs: number; // 0 = cast cancelled
}

// A telegraphed AoE about to land — clients render a growing warning ring.
export interface BossTelegraphMsg {
  t: MsgType.BossTelegraph;
  x: number;
  z: number;
  radius: number;
  delayMs: number;
}

export interface ChatMsg {
  t: MsgType.Chat;
  text: string;
}

export interface PingMsg {
  t: MsgType.Ping;
  clientTime: number;
}

export type ClientMessage =
  | JoinMsg
  | MoveIntentMsg
  | AttackIntentMsg
  | SkillIntentMsg
  | JobAdvanceMsg
  | UseItemMsg
  | EquipMsg
  | UnequipMsg
  | BuyItemMsg
  | SellItemMsg
  | StoreItemMsg
  | RetrieveItemMsg
  | PartyInviteMsg
  | PartyAcceptMsg
  | PartyLeaveMsg
  | CreateGuildMsg
  | JoinGuildMsg
  | LeaveGuildMsg
  | GuildStoreItemMsg
  | GuildRetrieveItemMsg
  | AcceptQuestMsg
  | ClaimQuestMsg
  | AllocateStatMsg
  | LevelSkillMsg
  | UnlockRuneMsg
  | RefineItemMsg
  | EnchantItemMsg
  | ToggleEnchantLockMsg
  | SocketCardMsg
  | UnsocketCardMsg
  | EnterPortalMsg
  | NpcHealMsg
  | WarpMsg
  | ExchangeBrowseMsg
  | ExchangeListMsg
  | ExchangeBuyMsg
  | ExchangeCancelMsg
  | ChatMsg
  | PingMsg;

// ---- Server -> Client ----

export interface JoinAckMsg {
  t: MsgType.JoinAck;
  selfId: number;
  tickRate: number;
  snapshotRate: number;
  mapSize: number;
  self: SelfState;
}

export interface SpawnMsg {
  t: MsgType.Spawn;
  entity: EntityFull;
}

export interface DespawnMsg {
  t: MsgType.Despawn;
  id: number;
}

export interface SnapshotMsg {
  t: MsgType.Snapshot;
  tick: number;
  time: number; // server ms timestamp
  entities: EntitySnapshot[];
}

export interface SelfSyncMsg {
  t: MsgType.SelfSync;
  self: SelfState;
}

export interface LootMsg {
  t: MsgType.Loot;
  items: Array<{ id: string; qty: number }>;
  zeny: number;
}

export interface PartyMember {
  id: number;
  name: string;
  level: number;
  job: JobId;
}

export interface PartyInfo {
  id: number;
  leaderId: number;
  members: PartyMember[];
}

export interface PartyInviteRecvMsg {
  t: MsgType.PartyInviteRecv;
  fromId: number;
  fromName: string;
  partyId: number;
}

export interface PartyUpdateMsg {
  t: MsgType.PartyUpdate;
  party: PartyInfo | null; // null = you are no longer in a party
}

export interface GuildInfo {
  id: number;
  name: string;
  masterId: number;
  members: PartyMember[];
  level: number;
  exp: number;
  expToNext: number;
  storage: Array<{ id: string; qty: number }>;
}

export interface GuildUpdateMsg {
  t: MsgType.GuildUpdate;
  guild: GuildInfo | null; // null = you are no longer in a guild
}

export interface DamageEventMsg {
  t: MsgType.DamageEvent;
  sourceId: number;
  targetId: number;
  amount: number;
  crit: boolean;
  miss: boolean;
  kind: DamageKind;
  skillId?: string; // present when the hit came from a skill (drives VFX)
  heal?: boolean; // amount restored HP rather than dealt damage
  elementMult?: number; // elemental effectiveness (>1 super-effective, <1 resisted)
}

export interface LevelUpMsg {
  t: MsgType.LevelUp;
  id: number;
  newLevel: number;
  maxHp: number;
  maxSp: number;
  stats: Stats;
  expToNext: number;
}

export interface ChatBroadcastMsg {
  t: MsgType.ChatBroadcast;
  fromId: number;
  name: string;
  text: string;
}

// A single live offer in the Exchange Centre.
export interface ExchangeListing {
  id: number;
  sellerId: number;
  sellerName: string;
  itemId: string;
  qty: number;
  unitPrice: number;
}

// The current marketplace, pushed to clients whenever it changes (or on browse).
export interface ExchangeUpdateMsg {
  t: MsgType.ExchangeUpdate;
  listings: ExchangeListing[];
}

// Global sky state — drives client visuals (sun/sky/fog/weather) and informs
// players of the elemental synergy currently in effect.
export interface WorldStateMsg {
  t: MsgType.WorldState;
  timeOfDay: number; // 0..1 (0 = midnight, 0.5 = noon)
  weather: Weather;
}

// Live HP of an engaged world boss, broadcast to EVERY player (cross-map) so the
// whole server can rally to the fight. `defeatedBy` is set on the final tick.
export interface BossStatusMsg {
  t: MsgType.BossStatus;
  bossId: number;
  name: string;
  hp: number;
  maxHp: number;
  mapName: string;
  defeatedBy?: string;
}

export interface PongMsg {
  t: MsgType.Pong;
  clientTime: number;
  serverTime: number;
}

export type ServerMessage =
  | JoinAckMsg
  | SpawnMsg
  | DespawnMsg
  | SnapshotMsg
  | SelfSyncMsg
  | LootMsg
  | PartyInviteRecvMsg
  | PartyUpdateMsg
  | GuildUpdateMsg
  | MapChangeMsg
  | DefeatedMsg
  | RefineResultMsg
  | BossTelegraphMsg
  | SkillCastMsg
  | DamageEventMsg
  | LevelUpMsg
  | ChatBroadcastMsg
  | WorldStateMsg
  | BossStatusMsg
  | ExchangeUpdateMsg
  | PongMsg;

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export function decodeClient(raw: string): ClientMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.t === "string") return obj as ClientMessage;
  } catch {
    /* ignore malformed */
  }
  return null;
}

export function decodeServer(raw: string): ServerMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.t === "string") return obj as ServerMessage;
  } catch {
    /* ignore malformed */
  }
  return null;
}
