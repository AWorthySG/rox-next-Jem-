import * as THREE from "three";
import { makeBlobShadow, makeToonGradient } from "./textures.js";
import { applyRimLight } from "./rimLight.js";

export interface CharacterMesh {
  group: THREE.Group;
  // Limbs exposed so the render loop can animate a simple walk cycle.
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  head: THREE.Object3D;
  headgear: THREE.Object3D | null; // currently-worn hat mesh, if any
  cape: THREE.Object3D | null; // swordsman cape pivot (sways with movement), if any
}

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x171019, side: THREE.BackSide });

function toon(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: makeToonGradient() });
  applyRimLight(m);
  return m;
}

// Add a black inverted-hull outline behind `mesh` for the anime cel-shaded edge.
function outline(parent: THREE.Object3D, mesh: THREE.Mesh, scale = 1.08): void {
  const o = new THREE.Mesh(mesh.geometry, OUTLINE_MAT);
  o.position.copy(mesh.position);
  o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale).multiplyScalar(scale);
  parent.add(o);
}

// A low-poly humanoid built from primitives, cel-shaded with toon materials and
// black outlines. `colorSeed` (0..360 hue) gives each player a distinct outfit
// tint; `magic` swaps the palette toward a mage robe.
export type WeaponStyle = "blade" | "staff" | "bow" | "mace";

export function buildCharacter(
  colorSeed: number,
  magic: boolean,
  weapon: WeaponStyle = magic ? "staff" : "blade",
): CharacterMesh {
  const group = new THREE.Group();
  let cape: THREE.Object3D | null = null;

  const hue = (colorSeed % 360) / 360;
  const skin = toon(0xf1c9a5);
  const outfit = toon(new THREE.Color().setHSL(hue, magic ? 0.6 : 0.62, magic ? 0.5 : 0.46));
  const accent = toon(new THREE.Color().setHSL((hue + 0.08) % 1, 0.55, 0.34));
  const hairMat = toon(new THREE.Color().setHSL((hue + 0.5) % 1, 0.45, 0.24));
  const bootMat = toon(new THREE.Color().setHSL((hue + 0.08) % 1, 0.4, 0.2));

  // torso (tapered) + a little collar
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.9, 10), outfit);
  torso.position.y = 1.15;
  outline(group, torso);
  group.add(torso);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.3, 10), accent);
  hips.position.y = 0.72;
  group.add(hips);

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 18), skin);
  head.position.y = 1.86;
  outline(group, head, 1.06);
  group.add(head);

  // hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 18, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat);
  hair.position.y = 1.9;
  group.add(hair);

  // anime face: two eyes on the front (+z) with a tiny white glint that catches bloom
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2230 });
  const eyeGeo = new THREE.SphereGeometry(0.058, 10, 10);
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const glintGeo = new THREE.SphereGeometry(0.018, 8, 8);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(0.85, 1.3, 0.5);
    eye.position.set(sx * 0.12, 1.88, 0.3);
    group.add(eye);
    const glint = new THREE.Mesh(glintGeo, glintMat);
    glint.position.set(sx * 0.12 + 0.025, 1.91, 0.33);
    group.add(glint);
  }

  // arms (pivot from the shoulder so they can swing), with little skin hands
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.55, 4, 8);
  const leftArm = limb(group, armGeo, accent, -0.44, 1.55, skin);
  const rightArm = limb(group, armGeo, accent, 0.44, 1.55, skin);

  // legs, with darker boots at the feet
  const legGeo = new THREE.CapsuleGeometry(0.12, 0.6, 4, 8);
  const leftLeg = limb(group, legGeo, bootMat, -0.16, 0.7, accent);
  const rightLeg = limb(group, legGeo, bootMat, 0.16, 0.7, accent);

  // class outfit flourish — deepens each archetype's silhouette
  if (weapon === "staff") {
    // mage robe: a long skirt over the legs
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.05, 12, 1, true), outfit);
    robe.position.y = 0.78;
    group.add(robe);
  } else if (weapon === "bow") {
    // archer quiver of arrows on the back
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), toon(0x6b4a2b));
    quiver.position.set(-0.2, 1.42, -0.24);
    quiver.rotation.x = -0.35;
    group.add(quiver);
    for (let i = -1; i <= 1; i++) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 5), toon(0xe8e2cc));
      arrow.position.set(-0.2 + i * 0.05, 1.72, -0.28);
      group.add(arrow);
    }
  } else if (weapon === "mace") {
    // acolyte shoulder mantle
    const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.42, 14, 1, true), toon(0xf2efe6));
    mantle.position.y = 1.46;
    group.add(mantle);
  } else {
    // swordsman pauldrons
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), accent);
      pad.position.set(s * 0.4, 1.5, 0);
      pad.scale.y = 0.7;
      group.add(pad);
    }
    // a flowing cape (pivots from the shoulders so it can sway)
    const capePivot = new THREE.Object3D();
    capePivot.position.set(0, 1.52, -0.18);
    const capeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.95, 1, 3),
      new THREE.MeshToonMaterial({ color: new THREE.Color().setHSL(hue, 0.62, 0.38), gradientMap: makeToonGradient(), side: THREE.DoubleSide }),
    );
    capeMesh.position.y = -0.46;
    capePivot.add(capeMesh);
    group.add(capePivot);
    cape = capePivot;
  }

  // class weapon — a distinct silhouette per archetype
  if (weapon === "staff") {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), toon(0x8a5a2b));
    staff.position.set(0.56, 1.25, 0.1);
    group.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), new THREE.MeshBasicMaterial({ color: 0x9fe0ff }));
    orb.position.set(0.56, 1.95, 0.1);
    group.add(orb); // bright → catches bloom
  } else if (weapon === "bow") {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 16, Math.PI * 1.25), toon(0x6b4a2b));
    bow.position.set(0.52, 1.2, 0.12);
    bow.rotation.set(0, 0, Math.PI / 2);
    group.add(bow);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.78, 4), toon(0xe8e2cc));
    string.position.set(0.52, 1.2, 0.12);
    group.add(string);
  } else if (weapon === "mace") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.95, 8), toon(0x8a6a3a));
    shaft.position.set(0.52, 1.15, 0.12);
    group.add(shaft);
    const macehead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), toon(0xe8e0c4));
    macehead.position.set(0.52, 1.64, 0.12);
    group.add(macehead);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
    gem.position.set(0.52, 1.64, 0.24);
    group.add(gem); // holy glint → catches bloom
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.04), toon(0xcfd6e6));
    blade.position.set(0.5, 1.2, 0.12);
    group.add(blade);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08), toon(0x6b4a2b));
    hilt.position.set(0.5, 0.78, 0.12);
    group.add(hilt);
  }

  // soft contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: makeBlobShadow(), transparent: true, depthWrite: false, opacity: 0.7 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== OUTLINE_MAT) o.castShadow = true;
  });

  return { group, leftArm, rightArm, leftLeg, rightLeg, head, headgear: null, cape };
}

function limb(
  group: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  pivotY: number,
  capMat?: THREE.Material,
): THREE.Object3D {
  const pivot = new THREE.Object3D();
  pivot.position.set(x, pivotY, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.32;
  outline(pivot, mesh);
  pivot.add(mesh);
  // a small rounded cap (hand / boot) at the end of the limb for a cleaner silhouette
  if (capMat) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), capMat);
    cap.position.y = -0.62;
    cap.scale.y = 0.85;
    pivot.add(cap);
  }
  group.add(pivot);
  return pivot;
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
  hat.position.y = char.head.position.y;
  hat.traverse((o) => {
    o.castShadow = true;
  });
  char.group.add(hat);
  char.headgear = hat;
}

function buildHeadgear(itemId: string): THREE.Object3D | null {
  const g = new THREE.Group();
  switch (itemId) {
    case "feather_beret": {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), toon(0x3a6b3a));
      cap.position.y = 0.22;
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8), toon(0xe8d36a));
      feather.position.set(0.22, 0.42, -0.05);
      feather.rotation.z = -0.7;
      g.add(cap, feather);
      break;
    }
    case "poring_hat": {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 14), toon(0xff9ecb));
      dome.position.y = 0.34;
      dome.scale.y = 0.8;
      g.add(dome);
      break;
    }
    case "apprentice_circlet": {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 20), toon(0x6fa8ff));
      band.position.y = 0.26;
      band.rotation.x = Math.PI / 2;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0x9fd6ff }));
      gem.position.set(0, 0.3, 0.3);
      g.add(band, gem);
      break;
    }
    case "gem_crown": {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 16, 1, true), toon(0xf4d98a));
      ring.position.y = 0.32;
      g.add(ring);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), toon(0xf4d98a));
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.sin(a) * 0.3, 0.46, Math.cos(a) * 0.3);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff5d7a }));
        gem.position.set(Math.sin(a) * 0.3, 0.34, Math.cos(a) * 0.3);
        g.add(spike, gem);
      }
      break;
    }
    case "valkyrie_helm": {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.9), toon(0xcfd6e6));
      dome.position.y = 0.26;
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), toon(0xf2f4fa));
        wing.position.set(side * 0.34, 0.42, 0);
        wing.rotation.z = side * 1.0;
        g.add(wing);
      }
      g.add(dome);
      break;
    }
    default: {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), toon(0x7a5a3a));
      cap.position.y = 0.22;
      g.add(cap);
    }
  }
  return g;
}
