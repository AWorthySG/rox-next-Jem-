import * as THREE from "three";
import type { EntityFull } from "@rox/shared";
import { applyHeadgear, buildCharacter, setEyeBlink, type CharacterMesh, type WeaponStyle } from "../procedural/characterMesh.js";
import { makeSpark } from "../procedural/textures.js";
import { env } from "../engine/env.js";
import { EntityView } from "./EntityView.js";
import { ModelRig } from "./ModelRig.js";

// Per-role look so townsfolk are tellable at a glance (ROX towns are full of
// distinct service NPCs): outfit hue, silhouette (via weapon/magic), and a hat.
const ROLE_LOOKS: Record<string, { seed: number; magic: boolean; weapon: WeaponStyle; hat: string | null }> = {
  shop: { seed: 330, magic: false, weapon: "mace", hat: "poring_hat" }, // Kafra: pink, friendly
  healer: { seed: 110, magic: true, weapon: "staff", hat: "apprentice_circlet" },
  guide: { seed: 200, magic: false, weapon: "bow", hat: "feather_beret" },
  refine: { seed: 25, magic: false, weapon: "mace", hat: null }, // Blacksmith: ember tones
  exchange: { seed: 48, magic: false, weapon: "blade", hat: "gem_crown" }, // Broker: gold
  portal: { seed: 265, magic: true, weapon: "staff", hat: "valkyrie_helm" }, // mystic gatekeeper
};

// A static town NPC. Renders a humanoid (or a npc_<role>.glb model if present)
// with a floating marker; clicking it (handled in main) opens the shop. No HP
// bar, no interpolation.
export class NpcView extends EntityView {
  readonly role: string;
  private bob = 0;
  private marker: THREE.Mesh;
  private glow: THREE.Mesh;
  private lantern: THREE.Sprite;
  private char: CharacterMesh;
  private rig: ModelRig;
  private blinkIn = 1.5 + Math.random() * 3;
  private blinkT = 0;

  constructor(entity: EntityFull) {
    super(entity, "nameplate npc", 2.2);
    this.role = entity.npcRole ?? "";
    const look = ROLE_LOOKS[this.role] ?? { seed: 48, magic: false, weapon: "blade" as WeaponStyle, hat: null };
    this.char = buildCharacter(look.seed, look.magic, look.weapon);
    if (look.hat) applyHeadgear(this.char, look.hat);
    this.char.group.userData.entityId = entity.id;
    this.group.add(this.char.group);
    this.group.rotation.y = entity.facing;

    // hide the HP bar for NPCs
    const bar = this.hpFillEl.parentElement;
    if (bar) bar.style.display = "none";

    // floating golden marker above the head
    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshBasicMaterial({ color: 0xffd24a }),
    );
    this.marker.position.set(0, 1.95, 0);
    this.marker.userData.entityId = entity.id;
    this.group.add(this.marker);

    // soft golden ground ring that signals an interactable NPC
    this.glow = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.74, 36),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.04;
    this.group.add(this.glow);

    // a warm lantern glow beside the NPC that lights up at night
    this.lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSpark(), color: 0xffb050, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lantern.scale.setScalar(1.6);
    this.lantern.position.set(0.5, 1.2, 0.2);
    this.group.add(this.lantern);

    // Optional mid-poly model by role: npc_<role>.glb.
    this.rig = new ModelRig(this.group, entity.id);
    void this.rig.tryLoad(`npc_${this.role}`, undefined, 1, () => {
      this.char.group.visible = false;
    }).then((swapped) => {
      if (swapped) this.modelBacked = true;
    });
  }

  protected override animate(dt: number): void {
    this.bob += dt * 2;
    this.marker.position.y = 1.95 + Math.sin(this.bob) * 0.12;
    this.marker.rotation.y += dt * 1.5;
    const t = Math.sin(this.bob * 1.3) * 0.5 + 0.5;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.28 + t * 0.24;
    this.glow.scale.setScalar(1 + t * 0.08);
    // lantern: lit at night, with a gentle flicker
    const flick = 0.85 + Math.sin(this.bob * 5) * 0.15;
    (this.lantern.material as THREE.SpriteMaterial).opacity = env.night * 0.85 * flick;
    this.lantern.visible = env.night > 0.05;
    // anime blink (procedural avatar only)
    if (!this.modelBacked) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blinkIn = 1.5 + Math.random() * 3.5;
        this.blinkT = 0.13;
      }
      if (this.blinkT > 0) {
        this.blinkT -= dt;
        setEyeBlink(this.char, this.blinkT > 0 ? 0.08 : 1);
      }
    }
    if (this.modelBacked) this.rig.update(dt); // NPCs are stationary → idle loop
  }

  override dispose(scene: THREE.Scene): void {
    this.rig.dispose();
    super.dispose(scene);
  }
}
