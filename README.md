# ROX-Next

An online multiplayer **3D RPG vertical slice** inspired by *Ragnarok X: Next Generation*.
Built with **Three.js** (browser client) and an **authoritative Node WebSocket server**,
sharing one TypeScript contract. All art is generated procedurally at runtime — no
copyrighted assets.

> This is a deliberately scoped *vertical slice*, architected to grow into a fuller game.
> It runs end-to-end today: click-to-move across a Poring field, fight monsters, gain EXP,
> level up, and see other connected players move and fight in real time.

## What's in the slice

- **Real multiplayer**: authoritative server at 20 Hz sim / 10 Hz snapshots; remote players
  are interpolated, the local player is client-predicted.
- **3D world**: procedurally textured grass field, sky dome, dynamic lighting & shadows,
  third-person follow camera (scroll to zoom, right-drag to orbit).
- **Combat**: click a monster to attack — classic RO-flavored damage (ATK/MATK vs DEF, hit/flee,
  crits), floating damage numbers, HP bars, monster death & respawn, monster AI
  (idle → wander → aggro → attack → leash).
- **Bestiary + boss**: Poring, Fabre, Drops and Lunatic field zones by difficulty, plus an
  MVP-style **Poring King** boss (crowned, 1600 HP, big EXP, slow respawn) in a northern arena.
- **Progression**: STR/AGI/VIT/INT/DEX/LUK stats, EXP curve, leveling with auto stat growth
  and full-heal on level-up (cap 20); HP/SP passive regen; **Zeny** drops from kills.
- **Classes, skills & job advancement**: start as Novice/Swordsman/Mage, then **advance**
  (Novice→Swordsman/Mage at Lv10, Swordsman→**Knight** / Mage→**Wizard** at Lv25). Skills are
  server-authoritative with SP cost, cooldowns, range and AoE — First Aid, Bash, Magnum Break,
  Fire Bolt, Thunder Storm, plus 2nd-job Pierce, Bowling Bash, Jupitel Thunder, Meteor Storm.
- **Items, loot & equipment**: monsters drop from per-species loot tables (auto-pickup);
  bag + equipment panel (key `I`); equip weapons/armor/accessories for stat bonuses (ATK/MATK/
  DEF/HP/SP and base-stat boosts) and quaff potions to restore HP/SP. The Poring King drops
  rare gear (King's Cleaver, Poring Crown).
- **Town NPC & shop economy**: a Kafra shopkeeper stands in town — click her to buy potions
  and starter gear or sell loot for Zeny, closing the economy loop.
- **Parties**: click another player to invite them; accept to group up. Party HUD shows live
  member HP, and EXP from kills is shared (with a bonus) among nearby members.
- **Quests**: a town Guide offers a kill-quest board (Poring Purge → Slay the King). Accept,
  track progress as you hunt, and claim EXP/Zeny/item rewards; quest credit shares with party.
- **Character building**: spend stat points earned on level-up into STR/AGI/VIT/INT/DEX/LUK
  from the HUD; visit the Blacksmith to refine equipped gear (+1…+10) with Zeny for flat
  ATK/MATK/DEF/HP bonuses.
- **Auto-battle**: the signature ROX convenience — toggle Auto (button or `T`) and your
  character automatically seeks the nearest monster, attacks, and casts ready skills.
- **Minimap**: a top-down radar showing you, other players, NPCs, monsters and the boss.
- **HUD & chat**: HP/SP/EXP bars, level, Zeny, stat panel, a hotkey **skill bar** with
  cooldown sweeps, nameplates, latency, and live chat.

## Run it

```bash
npm install
npm run dev
```

- Server starts on `ws://localhost:8080`, client (Vite) on `http://localhost:5173`.
- Open the client URL, pick a name and class, and **Enter World**.
- Open a **second browser tab** to see real-time multiplayer — both characters appear in each
  other's worlds.

### Controls

- **Left-click ground** → move there
- **Left-click a Poring** → attack it
- **Scroll** → zoom · **Right-drag** → orbit camera
- **Enter** → chat

## Architecture

Monorepo (npm workspaces):

| Package   | Role |
|-----------|------|
| `shared/` | Single-sourced contract: network protocol, stats, combat & leveling formulas, constants. Imported everywhere so client predictions match server truth. |
| `engine/` | Transport-agnostic authoritative simulation: world, fixed-timestep game loop, movement / monster-AI / combat / snapshot systems, and the client-message handler. Runs **both** on the server and in the browser. |
| `server/` | Thin `ws` transport adapter around `@rox/engine` (gateway + connection + heartbeat). In-memory world. |
| `client/` | Three.js rendering, procedural art (textures + low-poly meshes), entity interpolation, HUD/chat UI, and two transports: a WebSocket client (online) and a `LocalServer` that runs `@rox/engine` in-browser (solo/offline). |

### Online vs. solo

The client tries the WebSocket server first; if none is reachable within ~2.5s it
transparently falls back to **solo mode**, running the full engine in the browser. This is
why the game is playable on static hosting with no backend. Point at a real server by setting
`VITE_WS_URL` (e.g. `wss://your-server`) at build time to enable live multiplayer.

### Scripts

- `npm run dev` — run server + client together (recommended)
- `npm run dev:server` / `npm run dev:client` — run individually
- `npm run build` — build shared, typecheck engine + server, build client bundle
- `npm test` — headless end-to-end **server** smoke test (join, combat, leveling, multiplayer, chat)
- `npm run test:solo` — headless **solo-engine** test (the in-browser `LocalServer` path)
- `npm start` — run the server only

CI (GitHub Actions, `.github/workflows/ci.yml`) runs build + both tests on every push and PR.

## Deploy

The static client deploys to any static host. A `vercel.json` is included:

```bash
npm run build        # outputs client/dist
# deploy client/dist (Vercel: framework=null, output=client/dist)
```

The deployed site is immediately playable in **solo mode**. For live multiplayer, host the
`@rox/server` somewhere that supports persistent WebSockets and build the client with
`VITE_WS_URL` pointing at it.

## Deliberately deferred

Persistence/accounts, multiple maps & portals, interest management, full job/skill trees,
items/inventory/loot, binary protocol, anti-cheat, parties/guilds/NPCs/quests. See
`shared/src/constants.ts` for tunables.
