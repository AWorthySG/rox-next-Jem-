import * as THREE from "three";
import { JobId, MsgType, type ServerMessage } from "@rox/shared";
import { SceneManager } from "./engine/SceneManager.js";
import { CameraRig } from "./engine/CameraRig.js";
import { InputController } from "./engine/InputController.js";
import { Loop } from "./engine/Loop.js";
import { GameState } from "./state/GameState.js";
import { NetClient } from "./net/NetClient.js";
import { Hud } from "./ui/Hud.js";
import { ChatBox } from "./ui/ChatBox.js";
import { DamageNumbers } from "./ui/DamageNumbers.js";
import { makePoringTexture } from "./procedural/textures.js";

// ---- bootstrap engine ----
const root = document.getElementById("game-root")!;
const scene = new SceneManager(root);
const cameraRig = new CameraRig(scene.renderer.domElement);
const gameState = new GameState(scene.scene, makePoringTexture());
const hud = new Hud();
const damageNumbers = new DamageNumbers(scene.scene);

// ---- networking ----
const wsUrl = (import.meta.env.VITE_WS_URL as string) || `ws://${location.hostname}:8080`;
let selfId = -1;

const net = new NetClient({
  onOpen: () => setStatus("Connected — ready to enter.", "ok"),
  onClose: () => setStatus("Disconnected from server.", "err"),
  onMessage: handleMessage,
});

const chat = new ChatBox((text) => net.send({ t: MsgType.Chat, text }));

// ---- input → intents ----
const input = new InputController(
  scene.renderer.domElement,
  cameraRig.camera,
  scene.ground,
  () => gameState.getPickables(),
  {
    onMoveTo: (x, z) => {
      net.send({ t: MsgType.MoveIntent, x, z });
      gameState.self?.setMoveTarget(x, z);
    },
    onAttack: (id) => {
      net.send({ t: MsgType.AttackIntent, targetId: id });
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
      hud.setIdentity(msg.self.name, msg.self.job);
      hud.update(msg.self);
      hud.show();
      document.getElementById("login")!.classList.add("hidden");
      chat.system(`Welcome to Prontera Field, ${msg.self.name}!`);
      break;
    case MsgType.Spawn:
      gameState.addEntity(msg.entity);
      break;
    case MsgType.Despawn:
      gameState.removeEntity(msg.id);
      break;
    case MsgType.Snapshot:
      gameState.applySnapshot(msg.entities, performance.now());
      break;
    case MsgType.SelfSync:
      hud.update(msg.self);
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
  if (msg.miss) {
    damageNumbers.spawn(pos, "Miss", "miss");
  } else {
    const variant = msg.targetId === selfId ? "taken" : msg.crit ? "crit" : "";
    damageNumbers.spawn(pos, String(msg.amount), variant);
  }
}

// ---- login UI ----
let selectedJob: JobId = JobId.Novice;
const nameInput = document.getElementById("name-input") as HTMLInputElement;
const enterBtn = document.getElementById("enter-btn") as HTMLButtonElement;

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
  if (!net.connected) {
    setStatus("Still connecting to the server…", "err");
    return;
  }
  const name = nameInput.value.trim() || "Adventurer";
  net.send({ t: MsgType.Join, name, job: selectedJob });
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
  const self = gameState.self;
  if (self) followPos.copy(self.group.position);
  cameraRig.follow(followPos, dt);
  scene.render(cameraRig.camera);
}).start();

// connect on load
setStatus("Connecting…", "");
net.connect(wsUrl);
