// Message kinds carried in the `t` field of every protocol message.
export enum MsgType {
  // client -> server
  Join = "join",
  MoveIntent = "move",
  AttackIntent = "attack",
  SkillIntent = "skill",
  JobAdvance = "jobAdvance",
  UseItem = "useItem",
  Equip = "equip",
  Unequip = "unequip",
  BuyItem = "buyItem",
  SellItem = "sellItem",
  PartyInvite = "partyInvite",
  PartyAccept = "partyAccept",
  PartyLeave = "partyLeave",
  CreateGuild = "createGuild",
  JoinGuild = "joinGuild",
  LeaveGuild = "leaveGuild",
  AcceptQuest = "acceptQuest",
  ClaimQuest = "claimQuest",
  AllocateStat = "allocateStat",
  LevelSkill = "levelSkill",
  RefineItem = "refineItem",
  EnterPortal = "enterPortal",
  NpcHeal = "npcHeal",
  Warp = "warp",
  Chat = "chat",
  Ping = "ping",
  // server -> client
  JoinAck = "joinAck",
  Spawn = "spawn",
  Despawn = "despawn",
  Snapshot = "snapshot",
  SelfSync = "self",
  Loot = "loot",
  PartyInviteRecv = "partyInviteRecv",
  PartyUpdate = "partyUpdate",
  GuildUpdate = "guildUpdate",
  MapChange = "mapChange",
  Defeated = "defeated",
  DamageEvent = "damage",
  LevelUp = "levelUp",
  ChatBroadcast = "chatMsg",
  Pong = "pong",
}

export enum EntityKind {
  Player = "player",
  Monster = "monster",
  Npc = "npc",
}

export enum MonsterAIState {
  Idle = "idle",
  Wander = "wander",
  Aggro = "aggro",
  Attack = "attack",
  Dead = "dead",
}

export enum JobId {
  Novice = "novice",
  Swordsman = "swordsman",
  Mage = "mage",
  Archer = "archer",
  Acolyte = "acolyte",
  Knight = "knight",
  Wizard = "wizard",
  Hunter = "hunter",
  Priest = "priest",
  RuneKnight = "rune_knight",
  HighWizard = "high_wizard",
  Sniper = "sniper",
  HighPriest = "high_priest",
  DragonKnight = "dragon_knight",
  ArchMage = "arch_mage",
  Windhawk = "windhawk",
  Cardinal = "cardinal",
}

export enum DamageKind {
  Physical = "physical",
  Magic = "magic",
}

export enum ItemType {
  Weapon = "weapon",
  Armor = "armor",
  Accessory = "accessory",
  Consumable = "consumable",
}

export enum EquipSlot {
  Weapon = "weapon",
  Armor = "armor",
  Accessory = "accessory",
}

export enum StatusType {
  Slow = "slow", // reduced movement speed
  Stun = "stun", // cannot act
  Burn = "burn", // damage over time
}
