// World / simulation tuning. Shared so client predictions match server truth.

export const TICK_RATE = 20; // simulation steps per second
export const TICK_MS = 1000 / TICK_RATE;
export const SNAPSHOT_RATE = 10; // world snapshots broadcast per second
export const SNAPSHOT_EVERY_N_TICKS = TICK_RATE / SNAPSHOT_RATE;

// Square map centered on origin: coordinates range [-MAP_SIZE/2, +MAP_SIZE/2].
export const MAP_SIZE = 120;
export const MAP_HALF = MAP_SIZE / 2;

// Movement speeds in world-units per second.
export const PLAYER_SPEED = 9;
export const MONSTER_SPEED = 4;

// Combat / AI ranges (world units).
export const AGGRO_RANGE = 12;
export const ATTACK_RANGE = 2.2;
export const LEASH_RANGE = 28; // monster gives up beyond this from its spawn point
export const PLAYER_ATTACK_RANGE = 2.6;

// Attack cadence (ms between hits).
export const PLAYER_ATTACK_COOLDOWN_MS = 700;
export const MONSTER_ATTACK_COOLDOWN_MS = 1100;

// Respawn delay for dead monsters.
export const RESPAWN_MS = 6000;

// Wander behaviour.
export const WANDER_RADIUS = 8;
export const WANDER_PAUSE_MIN_MS = 1500;
export const WANDER_PAUSE_MAX_MS = 4000;

// Progression.
export const LEVEL_CAP = 40;

// Networking.
export const DEFAULT_PORT = 8080;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const CLIENT_TIMEOUT_MS = 15000;

// Client interpolation delay: render remote entities this far in the past (ms).
export const INTERP_DELAY_MS = 120;

// Passive regeneration (per second), applied on the server tick.
export const HP_REGEN_PER_SEC = 2.5;
export const SP_REGEN_PER_SEC = 3.5;

// Monetary drop range per monster kill (Zeny).
export const ZENY_MIN = 3;
export const ZENY_MAX = 14;

// Party EXP sharing: members within this range of a kill share the EXP, with a
// small bonus to reward grouping.
export const EXP_SHARE_RANGE = 45;
export const PARTY_EXP_BONUS = 1.15;
export const PARTY_MAX_SIZE = 6;
