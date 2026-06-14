import * as THREE from "three";

export interface CharacterMesh {
  group: THREE.Group;
  // Limbs exposed so the render loop can animate a simple walk cycle.
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  head: THREE.Object3D;
  headgear: THREE.Object3D | null; // currently-worn hat mesh, if any
}

// A low-poly humanoid built from primitives. `colorSeed` (0..360 hue) gives each
// player a distinct outfit tint; `magic` swaps the palette toward a mage robe.
export function buildCharacter(colorSeed: number, magic: boolean): CharacterMesh {
  const group = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: 0xf1c9a5 });
  const hue = (colorSeed % 360) / 360;
  const outfit = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(hue, magic ? 0.55 : 0.6, magic ? 0.45 : 0.42),
  });
  const accent = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL((hue + 0.08) % 1, 0.5, 0.3),
  });
  const hairMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL((hue + 0.5) % 1, 0.4, 0.25),
  });

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), outfit);
  torso.position.y = 1.15;
  group.add(torso);

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), skin);
  head.position.y = 1.85;
  group.add(head);

  // hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat);
  hair.position.y = 1.9;
  group.add(hair);

  // arms (pivot from the shoulder so they can swing)
  const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);
  const leftArm = limb(armGeo, accent, -0.46, 1.5);
  const rightArm = limb(armGeo, accent, 0.46, 1.5);
  group.add(leftArm, rightArm);

  // legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.22);
  const leftLeg = limb(legGeo, accent, -0.18, 0.72);
  const rightLeg = limb(legGeo, accent, 0.18, 0.72);
  group.add(leftLeg, rightLeg);

  // hint of class: mage gets a little staff, swordsman a blade
  if (magic) {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0x8a5a2b }));
    staff.position.set(0.55, 1.25, 0.1);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x8fd0ff }));
    orb.position.set(0.55, 1.85, 0.1);
    group.add(staff, orb);
  }

  group.traverse((o) => {
    o.castShadow = true;
  });

  return { group, leftArm, rightArm, leftLeg, rightLeg, head, headgear: null };
}

// Swap the worn hat. Each known headgear id maps to a distinct low-poly shape so
// players can read each other's gear at a glance; unknown ids get a generic cap.
export function applyHeadgear(char: CharacterMesh, itemId: string | null | undefined): void {
  if (char.headgear) {
    char.group.remove(char.headgear);
    char.headgear = null;
  }
  if (!itemId) return;
  const hat = buildHeadgear(itemId);
  if (!hat) return;
  hat.position.y = char.head.position.y; // anchor around the head centre
  hat.traverse((o) => {
    o.castShadow = true;
  });
  char.group.add(hat);
  char.headgear = hat;
}

function mat(color: number, opts: { emissive?: number } = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, emissive: opts.emissive ?? 0x000000 });
}

function buildHeadgear(itemId: string): THREE.Object3D | null {
  const g = new THREE.Group();
  switch (itemId) {
    case "feather_beret": {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0x3a6b3a));
      cap.position.y = 0.22;
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8), mat(0xe8d36a));
      feather.position.set(0.22, 0.42, -0.05);
      feather.rotation.z = -0.7;
      g.add(cap, feather);
      break;
    }
    case "poring_hat": {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 14), mat(0xff9ecb));
      dome.position.y = 0.34;
      dome.scale.y = 0.8;
      g.add(dome);
      break;
    }
    case "apprentice_circlet": {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 20), mat(0x6fa8ff, { emissive: 0x16315f }));
      band.position.y = 0.26;
      band.rotation.x = Math.PI / 2;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), mat(0x9fd6ff, { emissive: 0x2a5a8a }));
      gem.position.set(0, 0.3, 0.3);
      g.add(band, gem);
      break;
    }
    case "gem_crown": {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 16, 1, true), mat(0xf4d98a, { emissive: 0x5a4410 }));
      ring.position.y = 0.32;
      g.add(ring);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), mat(0xf4d98a, { emissive: 0x5a4410 }));
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.sin(a) * 0.3, 0.46, Math.cos(a) * 0.3);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), mat(0xff5d7a, { emissive: 0x661022 }));
        gem.position.set(Math.sin(a) * 0.3, 0.34, Math.cos(a) * 0.3);
        g.add(spike, gem);
      }
      break;
    }
    case "valkyrie_helm": {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.9), mat(0xcfd6e6, { emissive: 0x2a3242 }));
      dome.position.y = 0.26;
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), mat(0xf2f4fa));
        wing.position.set(side * 0.34, 0.42, 0);
        wing.rotation.z = side * 1.0;
        g.add(wing);
      }
      g.add(dome);
      break;
    }
    default: {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0x7a5a3a));
      cap.position.y = 0.22;
      g.add(cap);
    }
  }
  return g;
}

function limb(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, pivotY: number): THREE.Object3D {
  const pivot = new THREE.Object3D();
  pivot.position.set(x, pivotY, 0);
  const mesh = new THREE.Mesh(geo, mat);
  // shift the mesh down so it hangs from the pivot point
  mesh.position.y = -0.35;
  pivot.add(mesh);
  return pivot;
}
