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
- **Combat**: click a Poring to attack — classic RO-flavored damage (ATK/MATK vs DEF, hit/flee,
  crits), floating damage numbers, HP bars, monster death & respawn, monster AI
  (idle → wander → aggro → attack → leash).
- **Progression**: STR/AGI/VIT/INT/DEX/LUK stats, EXP curve, leveling with auto stat growth
  and full-heal on level-up (cap 20).
- **Classes**: Novice, Swordsman (melee), Mage (magic) with distinct base stats.
- **HUD & chat**: HP/SP/EXP bars, level, stat panel, nameplates, latency, and live chat.

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
| `shared/` | Single-sourced contract: network protocol, stats, combat & leveling formulas, constants. Imported by both sides so client predictions match server truth. |
| `server/` | Authoritative simulation: `ws` gateway, fixed-timestep game loop, movement / monster-AI / combat / snapshot systems. In-memory world. |
| `client/` | Three.js engine, procedural art (textures + low-poly meshes), entity interpolation, HUD/chat UI, WebSocket net client. |

### Scripts

- `npm run dev` — run server + client together (recommended)
- `npm run dev:server` / `npm run dev:client` — run individually
- `npm run build` — typecheck server, build client bundle
- `npm test` — headless end-to-end server smoke test (join, combat, leveling, multiplayer, chat)
- `npm start` — run the server only

CI (GitHub Actions, `.github/workflows/ci.yml`) runs build + smoke test on every push and PR.

## Deliberately deferred

Persistence/accounts, multiple maps & portals, interest management, full job/skill trees,
items/inventory/loot, binary protocol, anti-cheat, parties/guilds/NPCs/quests. See
`shared/src/constants.ts` for tunables.
