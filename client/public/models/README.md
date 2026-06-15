# Monster models (mid-poly drop-in)

Drop `.glb` / `.gltf` files here and a monster template can opt into one by
setting `model` on its entry in `client/src/procedural/monsters.ts`:

```ts
poring: { inner: "#ffd1e6", outer: "#ff9ec4", scale: 1, model: "poring.glb" },
```

Anything in `client/public/` is served at the site root, so `model: "poring.glb"`
loads from `/models/poring.glb`.

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

`demo_crystal.glb` is a generated mid-poly crystal construct with an `idle`
bob/spin clip, wired to the `jewel_drone` template as a live proof of the path.
Regenerate it with `npm run gen:model`; `npm run test:model` parses it with the
real `GLTFLoader` and runs the loader's clone → toon-convert → fit transforms
(and steps an `AnimationMixer`) headless in CI.

## Budget guidance

This targets **mid-poly** (a few thousand triangles per monster). Many of these
render at once on mobile GPUs, and there is no LOD yet — keep meshes lean, bake
detail into textures, and prefer a single material per model where possible.
