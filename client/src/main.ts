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
import { ShopPanel } from "./ui/ShopPanel.js";
import { QuestPanel } from "./ui/QuestPanel.js";
import { RefinePanel } from "./ui/RefinePanel.js";
import { SkillsPanel } from "./ui/SkillsPanel.js";
import { JobAdvance } from "./ui/JobAdvance.js";
import { PartyHud } from "./ui/PartyHud.js";
import { AutoBattle } from "./ui/AutoBattle.js";
import { MiniMap } from "./ui/MiniMap.js";
import { getItem, JOB_NAME, type JobId, type SelfState } from "@rox/shared";
import { buildMonsterAppearances } from "./procedural/monsters.js";

// ---- bootstrap engine ----
const root = document.getElementById("game-root")!;
const scene = new SceneManager(root);
const cameraRig = new CameraRig(scene.renderer.domElement);
const gameState = new GameState(scene.scene, buildMonsterAppearances());
const hud = new Hud((stat) => transport?.send({ t: MsgType.AllocateStat, stat }));
const damageNumbers = new DamageNumbers(scene.scene);
const miniMap = new MiniMap();

// Skill bar: casts on the current target (or nearest monster); heals target self.
let currentTargetId: number | null = null;
function attackMonster(id: number): void {
  currentTargetId = id;
  transport?.send({ t: MsgType.AttackIntent, targetId: id });
  gameState.self?.clearMoveTarget();
}
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

// Solo-mode persistence: progress is saved to localStorage and restored on join.
const SAVE_KEY = "rox-save-v1";
let lastSave = 0;
function loadSave(): SelfState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SelfState) : null;
  } catch {
    return null;
  }
}
function saveSolo(self: SelfState): void {
  if (mode !== "solo") return;
  const now = performance.now();
  if (now - lastSave < 1000) return; // debounce
  lastSave = now;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(self));
  } catch {
    /* storage full / unavailable */
  }
}

function fallbackToSolo(): void {
  if (!settle("solo")) return;
  const local = new LocalServer(handlers, loadSave());
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

const shop = new ShopPanel({
  onBuy: (itemId) => transport?.send({ t: MsgType.BuyItem, itemId, qty: 1 }),
  onSell: (itemId) => transport?.send({ t: MsgType.SellItem, itemId, qty: 1 }),
});

const quests = new QuestPanel({
  onAccept: (questId) => transport?.send({ t: MsgType.AcceptQuest, questId }),
  onClaim: (questId) => transport?.send({ t: MsgType.ClaimQuest, questId }),
});

const refine = new RefinePanel({
  onRefine: (slot) => transport?.send({ t: MsgType.RefineItem, slot }),
});

const skills = new SkillsPanel({
  onLevel: (skillId) => transport?.send({ t: MsgType.LevelSkill, skillId }),
});

let currentJob: JobId | null = null;
const jobAdvance = new JobAdvance((job) => transport?.send({ t: MsgType.JobAdvance, targetJob: job }));

const partyHud = new PartyHud(
  () => transport?.send({ t: MsgType.PartyLeave }),
  (id) => gameState.entityHp(id),
);

// Render an incoming party invite as an accept/decline banner.
function showInvite(fromName: string, partyId: number): void {
  const el = document.getElementById("invite-prompt")!;
  el.classList.remove("hidden");
  el.innerHTML = `<span>${fromName} invites you to a party.</span>`;
  const accept = document.createElement("button");
  accept.className = "ip-btn accept";
  accept.textContent = "Accept";
  accept.addEventListener("click", () => {
    transport?.send({ t: MsgType.PartyAccept, partyId });
    el.classList.add("hidden");
  });
  const decline = document.createElement("button");
  decline.className = "ip-btn";
  decline.textContent = "Decline";
  decline.addEventListener("click", () => el.classList.add("hidden"));
  el.appendChild(accept);
  el.appendChild(decline);
}

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
      // Clicking the shop NPC opens the shop instead of attacking.
      const role = gameState.npcRoleOf(id);
      if (role === "shop") {
        shop.open();
        return;
      }
      if (role === "guide") {
        quests.open();
        return;
      }
      if (role === "refine") {
        refine.open();
        return;
      }
      // Clicking another player invites them to a party.
      if (gameState.isRemotePlayer(id)) {
        transport?.send({ t: MsgType.PartyInvite, targetId: id });
        chat.system("Party invite sent.");
        return;
      }
      attackMonster(id);
    },
  },
);
void input;

const autoBattle = new AutoBattle(gameState, skillBar, () => currentTargetId, attackMonster);

function handleMessage(msg: ServerMessage): void {
  switch (msg.t) {
    case MsgType.JoinAck:
      selfId = msg.selfId;
      gameState.selfId = selfId;
      partyHud.setSelf(selfId);
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
      saveSolo(msg.self);
      if (msg.self.job !== currentJob) {
        currentJob = msg.self.job;
        hud.setIdentity(msg.self.name, JOB_NAME[msg.self.job]);
        skillBar.build(msg.self.job);
        chat.system(`You advanced to ${JOB_NAME[msg.self.job]}!`);
      }
      hud.update(msg.self);
      skillBar.setSp(msg.self.sp);
      inventory.sync(msg.self);
      shop.sync(msg.self);
      quests.sync(msg.self);
      refine.sync(msg.self);
      skills.sync(msg.self);
      jobAdvance.update(msg.self);
      break;
    case MsgType.Loot: {
      const names = msg.items.map((i) => `${getItem(i.id)?.name ?? i.id}${i.qty > 1 ? ` ×${i.qty}` : ""}`);
      if (names.length) chat.system(`Looted: ${names.join(", ")} (+${msg.zeny} Zeny)`);
      break;
    }
    case MsgType.PartyInviteRecv:
      showInvite(msg.fromName, msg.partyId);
      break;
    case MsgType.PartyUpdate:
      partyHud.setParty(msg.party);
      chat.system(msg.party ? "Party updated." : "You left the party.");
      break;
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
  autoBattle.update(dt);
  gameState.update(dt);
  damageNumbers.update();
  skillBar.update();
  partyHud.update();
  miniMap.update(gameState.blips());
  const self = gameState.self;
  if (self) followPos.copy(self.group.position);
  cameraRig.follow(followPos, dt);
  scene.render(cameraRig.camera);
}).start();

// Offer a reset if a saved solo character exists.
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
if (loadSave()) resetBtn.classList.remove("hidden");
resetBtn.addEventListener("click", () => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
  location.reload();
});

// connect on load
setStatus("Connecting…", "");
net.connect(wsUrl);
