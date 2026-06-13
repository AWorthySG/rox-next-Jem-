// Message kinds carried in the `t` field of every protocol message.
export enum MsgType {
  // client -> server
  Join = "join",
  MoveIntent = "move",
  AttackIntent = "attack",
  Chat = "chat",
  Ping = "ping",
  // server -> client
  JoinAck = "joinAck",
  Spawn = "spawn",
  Despawn = "despawn",
  Snapshot = "snapshot",
  SelfSync = "self",
  DamageEvent = "damage",
  LevelUp = "levelUp",
  ChatBroadcast = "chatMsg",
  Pong = "pong",
}

export enum EntityKind {
  Player = "player",
  Monster = "monster",
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
}

export enum DamageKind {
  Physical = "physical",
  Magic = "magic",
}
