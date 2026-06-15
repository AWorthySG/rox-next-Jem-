# Monster models (mid-poly drop-in)

**Name a model after its template id and drop it here — that's the whole wiring.**
A file named `<templateId>.glb` (e.g. `poring.glb`, `baphomet.glb`) is auto-loaded
by that template; no code change required. Run `npm run checklist` for the full
list of the 333 template filenames (also `docs/MODEL_CHECKLIST.md`).

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
  the death pop/fade drive every toon surface.
- The first embedded animation matching `idle|walk|run|move` (else the first clip)
  plays on a per-instance `AnimationMixer`. Skinned meshes are cloned with their
  own skeleton, so many copies animate independently while sharing geometry.

## Demo asset

`jewel_drone.glb` is a generated mid-poly crystal construct with an `idle`
bob/spin clip — it loads on the `jewel_drone` template purely by the naming
convention, as a live proof of the path. Regenerate it with `npm run gen:model`;
`npm run test:model` parses it with the real `GLTFLoader` and runs the loader's
clone → toon-convert → fit transforms (and steps an `AnimationMixer`) headless
in CI.

## Budget guidance

This targets **mid-poly** (a few thousand triangles per monster). Many of these
render at once on mobile GPUs, and there is no LOD yet — keep meshes lean, bake
detail into textures, and prefer a single material per model where possible.
