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
  AcceptQuest = "acceptQuest",
  ClaimQuest = "claimQuest",
  AllocateStat = "allocateStat",
  LevelSkill = "levelSkill",
  RefineItem = "refineItem",
  EnterPortal = "enterPortal",
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
  MapChange = "mapChange",
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
  Knight = "knight",
  Wizard = "wizard",
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
