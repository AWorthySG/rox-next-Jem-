// Headless end-to-end smoke test for the authoritative server.
// Boots the server, connects two WebSocket clients, and asserts that core
// systems work: join, world spawn, snapshots, self-sync, combat, EXP gain, and
// cross-client visibility + chat. Exits non-zero on failure (used by CI).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4000 + Math.floor(Math.random() * 3000); // random to avoid stale-port clashes
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
  const st = { name, self: null, monsters: new Map(), seenPlayers: new Set(), counts: {}, lastSelf: null, lastChat: null, chats: [], portals: {}, dmg: [], ws };
  ws.on("open", () => ws.send(JSON.stringify({ t: "join", name, job })));
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    st.counts[m.t] = (st.counts[m.t] || 0) + 1;
    if (m.t === "joinAck") { st.self = m.selfId; st.lastSelf = m.self; }
    if (m.t === "spawn" && m.entity.kind === "monster") st.monsters.set(m.entity.id, m.entity);
    if (m.t === "spawn" && m.entity.npcRole === "portal") {
      st.portal = { id: m.entity.id, x: m.entity.x, z: m.entity.z };
      st.portals[m.entity.name] = { id: m.entity.id, x: m.entity.x, z: m.entity.z };
    }
    if (m.t === "damage") { st.dmg.push({ sourceId: m.sourceId, targetId: m.targetId }); if (st.dmg.length > 200) st.dmg.shift(); }
    if (m.t === "mapChange") st.map = m.mapId;
    if (m.t === "spawn" && m.entity.kind === "player") st.seenPlayers.add(m.entity.id);
    if (m.t === "despawn") st.monsters.delete(m.id);
    if (m.t === "self") st.lastSelf = m.self;
    if (m.t === "damage" && m.skillId) st.skillDamage = (st.skillDamage || 0) + 1;
    if (m.t === "loot") st.loot = (st.loot || 0) + 1;
    if (m.t === "partyInviteRecv") st.invitePartyId = m.partyId;
    if (m.t === "partyUpdate") st.party = m.party;
    if (m.t === "guildUpdate") st.guild = m.guild;
    if (m.t === "duelRequestRecv") st.duelRequestFrom = m.fromId;
    if (m.t === "duelUpdate") st.duelOpponentId = m.opponentId;
    if (m.t === "chatMsg") { st.lastChat = `${m.name}: ${m.text}`; st.chats.push(`${m.name}: ${m.text}`); }
    if (m.t === "exchangeUpdate") st.listings = m.listings;
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
    const t = setTimeout(() => reject(new Error("server did not start in time")), 30000);
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
  check((a.loot ?? 0) > 0, "kills deliver loot messages");

  // Second client should see the first and vice versa; chat should broadcast.
  const b = client("Bob", "mage");
  await wait(1200);
  a.ws.send(JSON.stringify({ t: "chat", text: "hello bob" }));
  await wait(900);
  check(a.seenPlayers.has(b.self), "client A sees client B");
  check(b.seenPlayers.has(a.self), "client B sees client A");
  // order-independent: a later system broadcast must not mask the player chat
  check(b.chats.includes("Alice: hello bob"), "chat broadcasts between clients");

  // Party: Alice invites Bob, Bob accepts; both should see a 2-member party.
  a.ws.send(JSON.stringify({ t: "partyInvite", targetId: b.self }));
  await wait(400);
  check(b.invitePartyId != null, "party invite is received by target");
  b.ws.send(JSON.stringify({ t: "partyAccept", partyId: b.invitePartyId }));
  await wait(500);
  check((a.party?.members?.length ?? 0) === 2, "leader sees 2-member party");
  check((b.party?.members?.length ?? 0) === 2, "invitee sees 2-member party");

  // Guild: Alice creates a guild, Bob joins it by name; both see a 2-member guild.
  a.ws.send(JSON.stringify({ t: "createGuild", name: "Valkyries" }));
  await wait(400);
  check(a.guild?.name === "Valkyries", "guild create succeeds");
  b.ws.send(JSON.stringify({ t: "joinGuild", name: "Valkyries" }));
  await wait(400);
  check((a.guild?.members?.length ?? 0) === 2, "guild master sees 2 members");
  check((b.guild?.members?.length ?? 0) === 2, "joiner sees 2-member guild");

  // Exchange Centre: Alice farms enough Zeny to buy a potion from the shop
  // (deterministic — every kill yields Zeny), lists it; Bob earns Zeny and buys it.
  for (let i = 0; i < 90 && (a.lastSelf?.zeny ?? 0) < 60; i++) {
    const live = [...a.monsters.values()][0];
    if (live) {
      a.ws.send(JSON.stringify({ t: "move", x: live.x, z: live.z }));
      a.ws.send(JSON.stringify({ t: "attack", targetId: live.id }));
      if (i % 4 === 0) a.ws.send(JSON.stringify({ t: "skill", skillId: "bash", targetId: live.id }));
    }
    await wait(200);
  }
  a.ws.send(JSON.stringify({ t: "buyItem", itemId: "red_potion", qty: 1 }));
  await wait(400);
  const sellEntry = a.lastSelf.inventory.find((e) => e.id === "red_potion" && e.qty >= 1);
  check(sellEntry != null, "exchange: seller has an item to list");
  for (let i = 0; i < 80 && (b.lastSelf?.zeny ?? 0) <= 0; i++) {
    const live = [...b.monsters.values()][0];
    if (live) {
      b.ws.send(JSON.stringify({ t: "move", x: live.x, z: live.z }));
      b.ws.send(JSON.stringify({ t: "attack", targetId: live.id }));
      if (i % 4 === 0) b.ws.send(JSON.stringify({ t: "skill", skillId: "fire_bolt", targetId: live.id }));
    }
    await wait(200);
  }
  check((b.lastSelf?.zeny ?? 0) > 0, "exchange: buyer earned Zeny to spend");
  if (sellEntry) {
    const bobHad = b.lastSelf?.inventory?.find((e) => e.id === sellEntry.id)?.qty ?? 0;
    a.ws.send(JSON.stringify({ t: "exchangeList", itemId: sellEntry.id, qty: 1, unitPrice: 1 }));
    await wait(400);
    b.ws.send(JSON.stringify({ t: "exchangeBrowse" }));
    await wait(400);
    const listing = (b.listings ?? []).find((l) => l.itemId === sellEntry.id && l.sellerId === a.self);
    check(listing != null, "exchange: buyer sees the seller's listing on the market");
    if (listing) {
      b.ws.send(JSON.stringify({ t: "exchangeBuy", listingId: listing.id, qty: 1 }));
      await wait(500);
      const bobNow = b.lastSelf?.inventory?.find((e) => e.id === sellEntry.id)?.qty ?? 0;
      check(bobNow === bobHad + 1, "exchange: buyer receives the purchased item");
    }
  }

  // Map travel: walk a fresh client to the cave portal and enter it.
  const t = client("Traveler", "novice");
  await wait(1500);
  check(t.map === "field", "new player starts on the field map");
  const cavePortal = t.portals["Cave Portal"];
  check(cavePortal != null, "field has a cave portal NPC");
  if (cavePortal) {
    t.ws.send(JSON.stringify({ t: "move", x: cavePortal.x, z: cavePortal.z }));
    await wait(2600); // walk to the portal
    t.ws.send(JSON.stringify({ t: "enterPortal", npcId: cavePortal.id }));
    await wait(700);
  }
  check(t.map === "cave", "entering the portal moves the player to the cave map");

  // PvP: two duelists travel to the arena; one attacks the other.
  const d1 = client("Duelist1", "swordsman");
  const d2 = client("Duelist2", "swordsman");
  await wait(1500);

  // Structured PvP: a duel request lets two players fight right on the
  // (non-PvP) field map, without needing the arena at all.
  d1.ws.send(JSON.stringify({ t: "duelRequest", targetId: d2.self }));
  await wait(400);
  check(d2.duelRequestFrom === d1.self, "duel: request is delivered to the target");
  d2.ws.send(JSON.stringify({ t: "duelAccept", fromId: d1.self }));
  await wait(400);
  check(d1.duelOpponentId === d2.self && d2.duelOpponentId === d1.self, "duel: accepting pairs both duelists");
  for (let i = 0; i < 10; i++) {
    d1.ws.send(JSON.stringify({ t: "attack", targetId: d2.self }));
    await wait(200);
    if (d1.dmg.some((x) => x.sourceId === d1.self && x.targetId === d2.self)) break;
  }
  check(d1.dmg.some((x) => x.sourceId === d1.self && x.targetId === d2.self), "duel: a player can damage their duel opponent on a non-PvP map");
  d1.ws.send(JSON.stringify({ t: "duelCancel" }));
  await wait(400);
  check(d1.duelOpponentId === null, "duel: forfeiting ends the duel");

  const arenaPortal = d1.portals["Arena Portal"];
  check(arenaPortal != null, "field has an arena portal");
  if (arenaPortal) {
    for (const d of [d1, d2]) d.ws.send(JSON.stringify({ t: "move", x: arenaPortal.x, z: arenaPortal.z }));
    await wait(2700);
    for (const d of [d1, d2]) d.ws.send(JSON.stringify({ t: "enterPortal", npcId: arenaPortal.id }));
    await wait(800);
  }
  check(d1.map === "arena" && d2.map === "arena", "both duelists reach the PvP arena");
  for (let i = 0; i < 10; i++) {
    d1.ws.send(JSON.stringify({ t: "attack", targetId: d2.self }));
    await wait(200);
    if (d1.dmg.some((x) => x.sourceId === d1.self && x.targetId === d2.self)) break;
  }
  check(d1.dmg.some((x) => x.sourceId === d1.self && x.targetId === d2.self), "PvP: a player can damage another in the arena");

  d1.ws.close();
  d2.ws.close();
  t.ws.close();
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
