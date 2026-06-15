import * as THREE from "three";
import { loadModel } from "../procedural/modelLoader.js";
import { resolveModelFile } from "../procedural/modelManifest.js";

// Reusable mid-poly model attachment for any entity view (monster, player, NPC).
// Resolves <key>.glb via the manifest, swaps it in over the owner's procedural
// placeholder, and runs the animation controller: idle↔walk locomotion blending
// plus attack/hit/death one-shots that crossfade over the base loop.

export type ClipKind = "idle" | "walk" | "attack" | "hit" | "death";

const CLIP_PATTERNS: Record<ClipKind, RegExp> = {
  idle: /idle|breath/i,
  walk: /walk|run|move/i,
  attack: /attack|cast|skill|shoot|bite|swing/i,
  hit: /hit|hurt|damage|flinch|stagger/i,
  death: /death|die|dead|faint|defeat/i,
};

function resolveClips(clips: THREE.AnimationClip[]): Partial<Record<ClipKind, THREE.AnimationClip>> {
  const out: Partial<Record<ClipKind, THREE.AnimationClip>> = {};
  for (const kind of Object.keys(CLIP_PATTERNS) as ClipKind[]) {
    out[kind] = clips.find((c) => CLIP_PATTERNS[kind].test(c.name));
  }
  return out;
}

function collectToonMats(root: THREE.Object3D, out: THREE.MeshToonMaterial[]): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m instanceof THREE.MeshToonMaterial) out.push(m);
  });
}

export class ModelRig {
  private mixer: THREE.AnimationMixer | null = null;
  private clips: Partial<Record<ClipKind, THREE.AnimationClip>> = {};
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private oneShot: THREE.AnimationAction | null = null;
  private current: THREE.AnimationAction | null = null;
  private root: THREE.Group | null = null;
  private moving = false;
  private dead = false;
  private disposed = false;
  // Toon materials of the loaded model, exposed so the owner can drive hit/death flashes.
  readonly flashMats: THREE.MeshToonMaterial[] = [];

  constructor(private parent: THREE.Group, private entityId: number) {}

  get active(): boolean { return this.root !== null; }
  get group(): THREE.Group | null { return this.root; }
  get hasDeathClip(): boolean { return !!this.clips.death; }

  setMoving(m: boolean): void { this.moving = m; }

  // Resolve <key>.glb (or an explicit file) via the manifest and, if present,
  // load + swap it in. `onReady` runs right before the model is added, so the
  // owner can hide/remove its procedural placeholder. Returns true on swap.
  async tryLoad(key: string, explicit: string | undefined, scale: number, onReady: () => void): Promise<boolean> {
    const file = await resolveModelFile(key, explicit);
    if (!file || this.disposed) return false;
    let loaded;
    try {
      loaded = await loadModel(file);
    } catch (e) {
      console.warn(`[model] ${file} failed to load; keeping procedural mesh`, e);
      return false;
    }
    if (this.disposed) return false;

    loaded.scene.traverse((o) => (o.userData.entityId = this.entityId));
    loaded.scene.scale.setScalar(scale);
    onReady();
    this.parent.add(loaded.scene);
    this.root = loaded.scene;
    collectToonMats(loaded.scene, this.flashMats);

    if (loaded.animations.length) {
      this.mixer = new THREE.AnimationMixer(loaded.scene);
      this.clips = resolveClips(loaded.animations);
      const idle = this.clips.idle ?? this.clips.walk ?? loaded.animations[0];
      if (idle) (this.idleAction = this.mixer.clipAction(idle)).play();
      if (this.clips.walk && this.clips.walk !== idle) {
        this.walkAction = this.mixer.clipAction(this.clips.walk);
        this.walkAction.setEffectiveWeight(0).play();
      }
      this.current = this.idleAction;
      this.mixer.addEventListener("finished", () => this.returnToLoco());
    }
    return true;
  }

  // Play a non-looping clip if the model has one. Returns false otherwise, so
  // the owner can fall back to a procedural tell.
  playOneShot(kind: ClipKind): boolean {
    const clip = this.mixer && this.clips[kind];
    if (!clip || !this.mixer) return false;
    if (kind === "death") this.dead = true;
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = kind === "death";
    this.crossfadeTo(action, 0.08);
    this.oneShot = action;
    return true;
  }

  // Advance the mixer + keep the base loop synced to movement. Call each frame.
  update(dt: number): void {
    if (!this.mixer) return;
    this.updateLocomotion();
    this.mixer.update(dt);
  }

  // Advance the mixer only (used during the death fade — no locomotion blending).
  step(dt: number): void {
    this.mixer?.update(dt);
  }

  dispose(): void {
    this.disposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
  }

  private crossfadeTo(next: THREE.AnimationAction, dur: number): void {
    if (this.current === next) return;
    next.reset().setEffectiveWeight(1).fadeIn(dur).play();
    this.current?.fadeOut(dur);
    this.current = next;
  }

  private updateLocomotion(): void {
    if (this.oneShot || !this.idleAction) return;
    const want = this.moving && this.walkAction ? this.walkAction : this.idleAction;
    this.crossfadeTo(want, 0.18);
  }

  private returnToLoco(): void {
    this.oneShot = null;
    if (this.dead || !this.idleAction) return; // death clamps on its last frame
    this.current = null; // force a crossfade back to the base loop
    this.updateLocomotion();
  }
}
