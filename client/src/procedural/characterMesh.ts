import * as THREE from "three";

export interface CharacterMesh {
  group: THREE.Group;
  // Limbs exposed so the render loop can animate a simple walk cycle.
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
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

  return { group, leftArm, rightArm, leftLeg, rightLeg };
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
