import * as THREE from "three";
import { JobId, MsgType, getSkill, type ServerMessage } from "@rox/shared";
import { SceneManager } from "./engine/SceneManager.js";
import { CameraRig } from "./engine/CameraRig.js";
import { InputController } from "./engine/InputController.js";
import { Loop } from "./engine/Loop.js";
import { GameState } from "./state/GameState.js";
import { NetClient } from "./net/NetClient.js";
import { LocalServer } from "./net/LocalServer.js";
import type { NetHandlers, Transport } from "./net/Transport.js";
import { Hud } from "./ui/Hud.js";
import { ChatBox } from "./ui/ChatBox.js";
import { DamageNumbers } from "./ui/DamageNumbers.js";
import { SkillBar } from "./ui/SkillBar.js";
import { InventoryPanel } from "./ui/InventoryPanel.js";
import { JobAdvance } from "./ui/JobAdvance.js";
import { getItem, JOB_NAME, type JobId } from "@rox/shared";
import { buildMonsterAppearances } from "./procedural/monsters.js";

// ---- bootstrap engine ----
const root = document.getElementById("game-root")!;
const scene = new SceneManager(root);
const cameraRig = new CameraRig(scene.renderer.domElement);
const gameState = new GameState(scene.scene, buildMonsterAppearances());
const hud = new Hud();
const damageNumbers = new DamageNumbers(scene.scene);

// Skill bar: casts on the current target (or nearest monster); heals target self.
let currentTargetId: number | null = null;
const skillBar = new SkillBar((skillId) => {
  const def = getSkill(skillId);
  if (!def) return;
  const targetId = def.heal ? selfId : (currentTargetId ?? gameState.nearestMonsterId());
  if (targetId == null) return;
  transport?.send({ t: MsgType.SkillIntent, skillId, targetId });
});

// ---- transport (online WebSocket with automatic solo fallback) ----
const wsUrl = (import.meta.env.VITE_WS_URL as string) || `ws://${location.hostname}:8080`;
let selfId = -1;
let transport: Transport | null = null;
let mode: "online" | "solo" | null = null;

const enterBtn = document.getElementById("enter-btn") as HTMLButtonElement;
enterBtn.disabled = true;

const handlers: NetHandlers = {
  onOpen: () => {
    enterBtn.disabled = false;
    setStatus(mode === "solo" ? "Solo mode (offline) — ready." : "Connected (online) — ready.", "ok");
  },
  onClose: () => {
    if (mode === null) fallbackToSolo();
    else setStatus("Disconnected from server.", "err");
  },
  onMessage: handleMessage,
};

function settle(m: "online" | "solo"): boolean {
  if (mode !== null) return false;
  mode = m;
  clearTimeout(fallbackTimer);
  return true;
}

function fallbackToSolo(): void {
  if (!settle("solo")) return;
  const local = new LocalServer(handlers);
  transport = local;
  hud.setLatency(0);
  local.connect();
}

// Try online first; if it doesn't connect quickly, play solo in-browser.
const net = new NetClient({
  onOpen: () => {
    if (settle("online")) {
      transport = net;
      handlers.onOpen?.();
    }
  },
  onClose: handlers.onClose,
  onMessage: handlers.onMessage,
});
const fallbackTimer = window.setTimeout(() => {
  if (mode === null) fallbackToSolo();
}, 2500);

const chat = new ChatBox((text) => transport?.send({ t: MsgType.Chat, text }));

const inventory = new InventoryPanel({
  onUse: (itemId) => transport?.send({ t: MsgType.UseItem, itemId }),
  onEquip: (itemId) => transport?.send({ t: MsgType.Equip, itemId }),
  onUnequip: (slot) => transport?.send({ t: MsgType.Unequip, slot }),
});

let currentJob: JobId | null = null;
const jobAdvance = new JobAdvance((job) => transport?.send({ t: MsgType.JobAdvance, targetJob: job }));

// ---- input → intents ----
const input = new InputController(
  scene.renderer.domElement,
  cameraRig.camera,
  scene.ground,
  () => gameState.getPickables(),
  {
    onMoveTo: (x, z) => {
      transport?.send({ t: MsgType.MoveIntent, x, z });
      gameState.self?.setMoveTarget(x, z);
    },
    onAttack: (id) => {
      currentTargetId = id;
      transport?.send({ t: MsgType.AttackIntent, targetId: id });
      gameState.self?.clearMoveTarget();
    },
  },
);
void input;

function handleMessage(msg: ServerMessage): void {
  switch (msg.t) {
    case MsgType.JoinAck:
      selfId = msg.selfId;
      gameState.selfId = selfId;
      currentJob = msg.self.job;
      hud.setIdentity(msg.self.name, JOB_NAME[msg.self.job]);
      hud.update(msg.self);
      skillBar.build(msg.self.job);
      skillBar.setSp(msg.self.sp);
      jobAdvance.update(msg.self);
      hud.show();
      document.getElementById("login")!.classList.add("hidden");
      chat.system(
        mode === "solo"
          ? `Welcome to Prontera Field, ${msg.self.name}! (solo mode)`
          : `Welcome to Prontera Field, ${msg.self.name}!`,
      );
      break;
    case MsgType.Spawn:
      gameState.addEntity(msg.entity);
      break;
    case MsgType.Despawn:
      if (msg.id === currentTargetId) currentTargetId = null;
      gameState.removeEntity(msg.id);
      break;
    case MsgType.Snapshot:
      gameState.applySnapshot(msg.entities, performance.now());
      break;
    case MsgType.SelfSync:
      if (msg.self.job !== currentJob) {
        currentJob = msg.self.job;
        hud.setIdentity(msg.self.name, JOB_NAME[msg.self.job]);
        skillBar.build(msg.self.job);
        chat.system(`You advanced to ${JOB_NAME[msg.self.job]}!`);
      }
      hud.update(msg.self);
      skillBar.setSp(msg.self.sp);
      inventory.sync(msg.self);
      jobAdvance.update(msg.self);
      break;
    case MsgType.Loot: {
      const names = msg.items.map((i) => `${getItem(i.id)?.name ?? i.id}${i.qty > 1 ? ` ×${i.qty}` : ""}`);
      if (names.length) chat.system(`Looted: ${names.join(", ")} (+${msg.zeny} Zeny)`);
      break;
    }
    case MsgType.DamageEvent:
      onDamage(msg);
      break;
    case MsgType.LevelUp:
      if (msg.id === selfId) chat.system(`You reached level ${msg.newLevel}!`);
      break;
    case MsgType.ChatBroadcast:
      chat.add(msg.name, msg.text, msg.fromId === selfId);
      break;
    case MsgType.Pong:
      hud.setLatency(Math.round(performance.now() - msg.clientTime));
      break;
  }
}

function onDamage(msg: Extract<ServerMessage, { t: MsgType.DamageEvent }>): void {
  const pos = gameState.worldPosOf(msg.targetId);
  if (!pos) return;
  if (msg.heal) {
    damageNumbers.spawn(pos, `+${msg.amount}`, "heal");
  } else if (msg.miss) {
    damageNumbers.spawn(pos, "Miss", "miss");
  } else {
    const variant = msg.targetId === selfId ? "taken" : msg.crit ? "crit" : "";
    damageNumbers.spawn(pos, String(msg.amount), variant);
  }
}

// ---- login UI ----
let selectedJob: JobId = JobId.Novice;
const nameInput = document.getElementById("name-input") as HTMLInputElement;

document.querySelectorAll<HTMLButtonElement>(".job-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".job-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedJob = btn.dataset.job as JobId;
  });
});

enterBtn.addEventListener("click", enterWorld);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") enterWorld();
});

function enterWorld(): void {
  if (!transport || !transport.connected) {
    setStatus("Still connecting…", "err");
    return;
  }
  const name = nameInput.value.trim() || "Adventurer";
  transport.send({ t: MsgType.Join, name, job: selectedJob });
}

function setStatus(text: string, cls: "ok" | "err" | ""): void {
  const el = document.getElementById("conn-status")!;
  el.textContent = text;
  el.className = `conn-status ${cls}`;
}

// ---- render loop ----
const followPos = new THREE.Vector3();
new Loop((dt) => {
  gameState.update(dt);
  damageNumbers.update();
  skillBar.update();
  const self = gameState.self;
  if (self) followPos.copy(self.group.position);
  cameraRig.follow(followPos, dt);
  scene.render(cameraRig.camera);
}).start();

// connect on load
setStatus("Connecting…", "");
net.connect(wsUrl);
