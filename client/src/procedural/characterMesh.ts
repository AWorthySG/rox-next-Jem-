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

// A chibi anime humanoid in the ROX:NG style — roughly two heads tall with a big
// expressive face (colored irises, brows, blush) and a styled hair mesh (bangs,
// side tufts, back spike) — cel-shaded with toon materials and black outlines.
// `colorSeed` (0..360 hue) gives each player a distinct outfit/hair tint;
// `magic` swaps the palette toward a mage robe.
export type WeaponStyle = "blade" | "staff" | "bow" | "mace";

export function buildCharacter(
  colorSeed: number,
  magic: boolean,
  weapon: WeaponStyle = magic ? "staff" : "blade",
): CharacterMesh {
  const group = new THREE.Group();
  let cape: THREE.Object3D | null = null;

  const hue = (colorSeed % 360) / 360;
  const skin = toon(0xf6d3b2);
  const outfit = toon(new THREE.Color().setHSL(hue, magic ? 0.6 : 0.62, magic ? 0.5 : 0.46));
  const accent = toon(new THREE.Color().setHSL((hue + 0.08) % 1, 0.55, 0.34));
  const hairMat = toon(new THREE.Color().setHSL((hue + 0.5) % 1, 0.55, 0.42));
  const bootMat = toon(new THREE.Color().setHSL((hue + 0.08) % 1, 0.4, 0.2));

  // ---- stubby chibi body ----
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.45, 10), outfit);
  torso.position.y = 0.68;
  outline(group, torso);
  group.add(torso);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.18, 10), accent);
  hips.position.y = 0.42;
  group.add(hips);

  // belt with a golden buckle — a small touch every ROX outfit shares
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 12), toon(0x4a3524));
  belt.position.y = 0.5;
  group.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), new THREE.MeshBasicMaterial({ color: 0xf0c25a }));
  buckle.position.set(0, 0.5, 0.3);
  group.add(buckle);

  // ---- big chibi head ----
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 18), skin);
  head.position.y = 1.32;
  outline(group, head, 1.05);
  group.add(head);

  // ---- anime face: big colored-iris eyes, brows and blush ----
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x241c2c });
  const irisMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((hue + 0.6) % 1, 0.55, 0.42) });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), eyeMat);
    eye.scale.set(0.85, 1.4, 0.45);
    eye.position.set(sx * 0.16, 1.32, 0.37);
    group.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), irisMat);
    iris.scale.set(0.85, 1.35, 0.5);
    iris.position.set(sx * 0.16, 1.31, 0.395);
    group.add(iris);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), glintMat);
    glint.position.set(sx * 0.16 + 0.03, 1.36, 0.425);
    group.add(glint);
    const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), glintMat);
    glint2.position.set(sx * 0.16 - 0.025, 1.27, 0.425);
    group.add(glint2);
    // eyebrow: a thin tilted bar above the eye
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.02), eyeMat);
    brow.position.set(sx * 0.16, 1.47, 0.395);
    brow.rotation.z = sx * -0.12;
    group.add(brow);
    // soft blush mark on the cheek
    const blush = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 10),
      new THREE.MeshBasicMaterial({ color: 0xff9daa, transparent: true, opacity: 0.55 }),
    );
    blush.position.set(sx * 0.27, 1.2, 0.335);
    blush.rotation.y = sx * 0.55;
    group.add(blush);
  }

  // ---- styled hair: cap + swept bangs + side tufts + back spike ----
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.455, 20, 18, 0, Math.PI * 2, 0, Math.PI / 1.65),
    hairMat,
  );
  hairCap.position.y = 1.37;
  group.add(hairCap);
  // front bangs: a row of little cones sweeping across the forehead
  for (let i = -2; i <= 2; i++) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 6), hairMat);
    bang.position.set(i * 0.135, 1.5, 0.38 - Math.abs(i) * 0.03);
    bang.rotation.x = Math.PI - 0.45; // point down over the brow
    bang.rotation.z = i * 0.16;
    group.add(bang);
  }
  // side tufts
  for (const sx of [-1, 1]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), hairMat);
    tuft.position.set(sx * 0.42, 1.28, 0.08);
    tuft.rotation.x = Math.PI;
    tuft.rotation.z = sx * 0.25;
    group.add(tuft);
  }
  // back spike
  const backTuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 6), hairMat);
  backTuft.position.set(0, 1.35, -0.38);
  backTuft.rotation.x = Math.PI - 0.7;
  group.add(backTuft);

  // ---- stubby limbs (pivot from shoulder/hip so they can swing) ----
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.26, 4, 8);
  const leftArm = limb(group, armGeo, accent, -0.34, 0.86, skin);
  const rightArm = limb(group, armGeo, accent, 0.34, 0.86, skin);

  const legGeo = new THREE.CapsuleGeometry(0.11, 0.22, 4, 8);
  const leftLeg = limb(group, legGeo, bootMat, -0.14, 0.38, accent);
  const rightLeg = limb(group, legGeo, bootMat, 0.14, 0.38, accent);

  // ---- class outfit flourish — deepens each archetype's silhouette ----
  if (weapon === "staff") {
    // mage robe: a long skirt over the legs, with a glowing hem and shoulder cowl
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.66, 12, 1, true), outfit);
    robe.position.y = 0.4;
    group.add(robe);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.024, 8, 20), new THREE.MeshBasicMaterial({ color: 0x9fd6ff }));
    hem.position.y = 0.1;
    hem.rotation.x = Math.PI / 2;
    group.add(hem);
    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 12, 1, true), accent);
    cowl.position.y = 0.88;
    group.add(cowl);
  } else if (weapon === "bow") {
    // archer quiver of arrows on the back + a leather chest strap
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), toon(0x6b4a2b));
    quiver.position.set(-0.16, 0.74, -0.2);
    quiver.rotation.x = -0.35;
    group.add(quiver);
    for (let i = -1; i <= 1; i++) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.15, 5), toon(0xe8e2cc));
      arrow.position.set(-0.16 + i * 0.045, 0.97, -0.24);
      group.add(arrow);
    }
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.03), toon(0x5a3a22));
    strap.position.set(0, 0.7, 0.26);
    strap.rotation.z = 0.7;
    group.add(strap);
  } else if (weapon === "mace") {
    // acolyte shoulder mantle with a gold trim ring and chest emblem
    const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.34, 14, 1, true), toon(0xf2efe6));
    mantle.position.y = 0.86;
    group.add(mantle);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.395, 0.02, 8, 20), new THREE.MeshBasicMaterial({ color: 0xf0c25a }));
    trim.position.y = 0.7;
    trim.rotation.x = Math.PI / 2;
    group.add(trim);
    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
    emblem.position.set(0, 0.62, 0.28);
    group.add(emblem);
  } else {
    // swordsman pauldrons + a metal chest plate
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), accent);
      pad.position.set(s * 0.32, 0.9, 0);
      pad.scale.y = 0.7;
      group.add(pad);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.05), toon(0xcfd6e6));
    plate.position.set(0, 0.72, 0.25);
    group.add(plate);
    // a flowing cape (pivots from the shoulders so it can sway)
    const capePivot = new THREE.Object3D();
    capePivot.position.set(0, 0.9, -0.18);
    const capeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.62, 1, 3),
      new THREE.MeshToonMaterial({ color: new THREE.Color().setHSL(hue, 0.62, 0.38), gradientMap: makeToonGradient(), side: THREE.DoubleSide }),
    );
    capeMesh.position.y = -0.3;
    capePivot.add(capeMesh);
    group.add(capePivot);
    cape = capePivot;
  }

  // ---- class weapon — a distinct silhouette per archetype ----
  if (weapon === "staff") {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), toon(0x8a5a2b));
    staff.position.set(0.5, 0.66, 0.1);
    group.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), new THREE.MeshBasicMaterial({ color: 0x9fe0ff }));
    orb.position.set(0.5, 1.16, 0.1);
    group.add(orb); // bright → catches bloom
  } else if (weapon === "bow") {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 16, Math.PI * 1.25), toon(0x6b4a2b));
    bow.position.set(0.48, 0.64, 0.12);
    bow.rotation.set(0, 0, Math.PI / 2);
    group.add(bow);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.58, 4), toon(0xe8e2cc));
    string.position.set(0.48, 0.64, 0.12);
    group.add(string);
  } else if (weapon === "mace") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 8), toon(0x8a6a3a));
    shaft.position.set(0.48, 0.62, 0.12);
    group.add(shaft);
    const macehead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), toon(0xe8e0c4));
    macehead.position.set(0.48, 0.95, 0.12);
    group.add(macehead);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
    gem.position.set(0.48, 0.95, 0.23);
    group.add(gem); // holy glint → catches bloom
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.035), toon(0xcfd6e6));
    blade.position.set(0.46, 0.64, 0.12);
    group.add(blade);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.07), toon(0x6b4a2b));
    hilt.position.set(0.46, 0.32, 0.12);
    group.add(hilt);
  }

  // soft contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
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
  mesh.position.y = -0.17;
  outline(pivot, mesh);
  pivot.add(mesh);
  // a small rounded cap (hand / boot) at the end of the limb for a cleaner silhouette
  if (capMat) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), capMat);
    cap.position.y = -0.35;
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
  hat.scale.setScalar(1.25); // hats were sized for a smaller head; fit the chibi dome
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
