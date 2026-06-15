# Entity models (mid-poly drop-in)

**Name a model after its entity and drop it here — that's the whole wiring.** The
same loader/animation pipeline serves monsters, players, and NPCs:

| Entity | Filename convention | Example |
|--------|--------------------|---------|
| Monster / boss | `<templateId>.glb` | `poring.glb`, `baphomet.glb` |
| Player avatar | `char_<job>.glb` | `char_swordsman.glb`, `char_mage.glb` |
| Town NPC | `npc_<role>.glb` | `npc_blacksmith.glb` |

No code change required — the matching entity auto-loads it. Run `npm run checklist`
for the full list of the 333 monster filenames (also `docs/MODEL_CHECKLIST.md`).

How the auto-wiring works:

- `npm run gen:manifest` (also run by `npm run build`) scans this folder and writes
  `manifest.json`. The client fetches it once and only loads a model for a template
  if its `<id>.glb` is listed — so missing models cost nothing (no 404 storm).
- After adding/removing a `.glb`, regenerate with `npm run gen:manifest` (a plain
  `npm run build` does this for you).

Need a custom filename instead of the convention? Set `model` on the template in
`client/src/procedural/monsters.ts` and it takes precedence:

```ts
poring: { inner: "#ffd1e6", outer: "#ff9ec4", scale: 1, model: "special.glb" },
```

Anything in `client/public/` is served at the site root, so models load from
`/models/<file>`.

## How it behaves

- The procedural primitive mesh is built **immediately** as a placeholder and is
  swapped for the model once it finishes loading. If the file is missing or fails
  to parse, the procedural mesh simply stays — nothing breaks.
- Models are **auto-fitted**: scaled so the mesh is ~1.4 units tall with its feet
  at `y = 0` and centred on X/Z, then multiplied by the template `scale`. So a
  `scale: 1` model matches a `scale: 1` Poring in size regardless of export units.
- Materials are **toon-converted** by default (base colour + texture preserved,
  cel gradient applied) so models match the game's cel-shaded look. Hit-flash and
  the death fade drive every toon surface.
- **Compression supported:** plain glTF, Draco, and meshopt all load (the build
  copies the Draco decoder to `/draco/`; meshopt is built in). Compress with
  `gltfpack` (meshopt) or `gltf-pipeline` (Draco) to keep files small.
- Skinned meshes are cloned with their own skeleton, so many copies animate
  independently while sharing geometry.

### Animation clips (optional, matched by name keyword)

| Event | Clip name contains | Fallback if absent |
|-------|--------------------|--------------------|
| idle (loops) | `idle` / `breath` (else `walk`/`run`/`move`, else first clip) | gentle procedural bob |
| walk | `walk` / `run` / `move` | — |
| attack | `attack` / `cast` / `skill` / `shoot` / `bite` / `swing` | procedural forward lunge |
| hit | `hit` / `hurt` / `damage` / `flinch` | white flash (always plays too) |
| death | `death` / `die` / `dead` / `faint` | procedural pop + spin |

The base loop crossfades between `idle` and `walk` automatically as the monster
moves. One-shots (attack/hit/death) crossfade over the base loop and return to
it; a death clip clamps on its last frame while the body fades out.

## Validate before committing

`npm run check:models` (also a CI step) parses every model here, prints triangle
counts + clip names, and warns on over-budget meshes, missing idle/walk clips, or
filenames that aren't a real template id.

## Demo asset

`jewel_drone.glb` is a generated mid-poly crystal construct (788 tris) with an
`idle` bob/spin clip — it loads on the `jewel_drone` template purely by the naming
convention, as a live proof of the path. Regenerate it with `npm run gen:model`;
`npm run test:model` parses it with the real `GLTFLoader` and runs the loader's
clone → toon-convert → fit transforms (and steps an `AnimationMixer`) headless
in CI.

## Budget guidance

This targets **mid-poly** (a few thousand triangles per monster). Many of these
render at once on mobile GPUs, and there is no LOD yet — keep meshes lean, bake
detail into textures, and prefer a single material per model where possible.
