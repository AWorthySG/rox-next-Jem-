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
- **Bestiary + bosses**: Poring, Fabre, Drops, Lunatic, plus Glast Heim's Zombies and
  Skeletons; two MVP bosses — the **Poring King** and **Baphomet** (6000 HP) — with rare drops.
- **Progression**: STR/AGI/VIT/INT/DEX/LUK stats, EXP curve, leveling with auto stat growth
  and full-heal on level-up (cap 20); HP/SP passive regen; **Zeny** drops from kills.
- **Classes, skills & job advancement**: start as Novice, Swordsman, Mage, **Archer** or
  **Acolyte**, **advance** at Lv25 to **Knight / Wizard / Hunter / Priest**, at Lv45 to the
  transcendent **Rune Knight / High Wizard / Sniper / High Priest**, then at Lv70 to the 4th-tier
  **Dragon Knight / Arch Mage / Windhawk / Cardinal** (**level cap 130**). Each line has
  its own server-authoritative skill kit — Bash/Magnum Break,
  Fire/Thunder, Double Strafe/Arrow Shower, Heal/Holy Light, plus 2nd-job skills (Pierce,
  Bowling Bash, Jupitel Thunder, Meteor Storm, Blitz Beat, Sharp Shooting, Magnus Exorcismus,
  Blessing) — with SP cost, cooldowns, range, AoE, status effects and buffs.
- **Items, loot & equipment**: monsters drop from per-species loot tables (auto-pickup);
  bag + equipment panel (key `I`); equip weapons/armor/accessories for stat bonuses (ATK/MATK/
  DEF/HP/SP and base-stat boosts) and quaff potions to restore HP/SP. The Poring King drops
  rare gear (King's Cleaver, Poring Crown).
- **Town services**: a Kafra shopkeeper (buy/sell), a Guide (quests), a Blacksmith (refine),
  a **Healer** (full HP/SP restore) and a **Warp Girl** (quick-travel to any map) staff the town.
- **Parties**: click another player to invite them; accept to group up. Party HUD shows live
  member HP, and EXP from kills is shared (with a bonus) among nearby members.
- **Guilds**: create or join a named guild (window `G`); members show a `[guild]` tag above
  their head and share a roster.
- **Quests**: a town Guide offers a kill-quest board (Poring Purge → Slay the King). Accept,
  track progress as you hunt, and claim EXP/Zeny/item rewards; quest credit shares with party.
- **Character building**: spend stat points earned on level-up into STR/AGI/VIT/INT/DEX/LUK
  from the HUD; level up individual skills (window `K`) with skill points to scale their power;
  visit the Blacksmith to refine equipped gear (+1…+10) with Zeny for flat ATK/MATK/DEF/HP.
- **Status effects**: skills inflict debuffs — Fire Bolt/Meteor Storm **burn** (DoT),
  Magnum Break **slows**, Thunder Storm/Bowling Bash **stun** — resolved server-side.
- **Self-buffs**: Battle Focus (+30% ATK) and Mystic Focus (+30% MATK) temporarily empower
  the caster, shown as timed chips on the HUD.
- **Achievements**: milestone goals (kills, levels, boss slays) tracked server-side, unlocked
  with Zeny rewards and an unlock toast (window `V`).
- **Pets**: use a pet egg (dropped by Porings, Lunatics, Baphomet, or bought) to summon a
  companion that trails you and grants a passive stat bonus.
- **Mounts**: buy a Peco Peco Whistle to ride a mount for faster movement (toggle on/off).
- **Auto-battle**: the signature ROX convenience — toggle Auto (button or `T`) and your
  character automatically seeks the nearest monster, attacks, and casts ready skills.
- **Minimap**: a top-down radar showing you, other players, NPCs, monsters and the boss.
- **ROX-style mobile HUD**: warm amber UI, a circular character portrait with stacked HP/SP/EXP
  bars, a radial skill cluster of round cooldown buttons (bottom-right), big skill-name cast
  popups and punchy gold damage numbers.
- **Multiple maps**: a portal-linked progression — **Prontera Field → Payon Forest → Poring
  Cave → Glast Heim → Aldebaran Clock Tower → Comodo Beach → Umbala Jungle → Juno → Einbroch →
  Rachel → Endless Tower**, plus the **PvP Arena**. Each map is themed, networked independently,
  and guarded by **two MVP bosses**.
- **30+ monsters & 20+ MVP bosses** across the world, from Porings to Beelzebub (Lv125).
- **Boss fight mechanics**: bosses use distinct, server-driven abilities — **enrage** (harder
  hits below a HP threshold), **AoE nova** (periodic blast around the boss), **summon adds**
  (temporary minions), and **self-heal** — mixed per boss (e.g. Beelzebub does all four).
- **PvP**: in the Arena, click another player to fight them; defeating one announces it and
  respawns the loser.
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
why the game is playable on static hosting with no backend. **Solo progress is saved to
`localStorage`** and restored on the next visit (with a "New Character" reset on the login).
Point at a real server by setting `VITE_WS_URL` (e.g. `wss://your-server`) at build time to
enable live multiplayer.

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
