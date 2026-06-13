// Headless end-to-end smoke test for the authoritative server.
// Boots the server, connects two WebSocket clients, and asserts that core
// systems work: join, world spawn, snapshots, self-sync, combat, EXP gain, and
// cross-client visibility + chat. Exits non-zero on failure (used by CI).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8123;
const failures = [];
function check(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failures.push(label);
  }
}

function client(name, job) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const st = { name, self: null, monsters: new Map(), seenPlayers: new Set(), counts: {}, lastSelf: null, lastChat: null, ws };
  ws.on("open", () => ws.send(JSON.stringify({ t: "join", name, job })));
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    st.counts[m.t] = (st.counts[m.t] || 0) + 1;
    if (m.t === "joinAck") { st.self = m.selfId; st.lastSelf = m.self; }
    if (m.t === "spawn" && m.entity.kind === "monster") st.monsters.set(m.entity.id, m.entity);
    if (m.t === "spawn" && m.entity.kind === "player") st.seenPlayers.add(m.entity.id);
    if (m.t === "despawn") st.monsters.delete(m.id);
    if (m.t === "self") st.lastSelf = m.self;
    if (m.t === "damage" && m.skillId) st.skillDamage = (st.skillDamage || 0) + 1;
    if (m.t === "chatMsg") st.lastChat = `${m.name}: ${m.text}`;
  });
  return st;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = spawn("npx", ["tsx", "server/src/index.ts"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "ignore"],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start in time")), 15000);
    server.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) { clearTimeout(t); resolve(); }
    });
  });
  // Drain further server output so its pipe buffer never fills or breaks.
  server.stdout.resume();

  const stopServer = () =>
    new Promise((resolve) => {
      server.once("exit", () => resolve());
      server.kill("SIGTERM");
      setTimeout(resolve, 2000);
    });

  const a = client("Alice", "swordsman");
  await wait(1500);
  check(a.self != null, "client receives joinAck with selfId");
  check(a.monsters.size > 0, "world spawns monsters (Porings)");

  // Attack the nearest Poring repeatedly (and cast Bash) to confirm combat + EXP.
  const startExp = a.lastSelf?.exp ?? 0;
  const startZeny = a.lastSelf?.zeny ?? 0;
  for (let i = 0; i < 60; i++) {
    const live = [...a.monsters.values()][0];
    if (live) {
      a.ws.send(JSON.stringify({ t: "move", x: live.x, z: live.z }));
      a.ws.send(JSON.stringify({ t: "attack", targetId: live.id }));
      if (i % 4 === 0) a.ws.send(JSON.stringify({ t: "skill", skillId: "bash", targetId: live.id }));
    }
    await wait(200);
    if ((a.lastSelf?.exp ?? 0) > startExp || (a.lastSelf?.level ?? 1) > 1) break;
  }

  check((a.counts.snapshot ?? 0) > 10, "receives periodic snapshots (10 Hz)");
  check((a.counts.self ?? 0) > 10, "receives per-player self-sync");
  check((a.counts.damage ?? 0) > 0, "combat produces damage events");
  check((a.skillDamage ?? 0) > 0, "skills (Bash) produce damage events");
  const progressed = (a.lastSelf.exp > startExp) || a.lastSelf.level > 1;
  check(progressed, "killing monsters awards EXP / levels up");
  check(a.lastSelf.zeny > startZeny, "killing monsters awards Zeny");

  // Second client should see the first and vice versa; chat should broadcast.
  const b = client("Bob", "mage");
  await wait(1200);
  a.ws.send(JSON.stringify({ t: "chat", text: "hello bob" }));
  await wait(600);
  check(a.seenPlayers.has(b.self), "client A sees client B");
  check(b.seenPlayers.has(a.self), "client B sees client A");
  check(b.lastChat === "Alice: hello bob", "chat broadcasts between clients");

  a.ws.close();
  b.ws.close();
  await stopServer();

  if (failures.length) {
    console.error(`\nSMOKE TEST FAILED (${failures.length}): ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("\nSMOKE TEST PASSED");
  process.exit(0);
}

main().catch((err) => {
  console.error("smoke test error:", err);
  process.exit(1);
});
