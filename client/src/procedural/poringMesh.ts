import * as THREE from "three";

export interface PoringMesh {
  group: THREE.Group;
  body: THREE.Mesh;
}

// A Poring: a squashed jelly sphere wearing its face texture, plus stubby feet.
export function buildPoring(faceTexture: THREE.Texture): PoringMesh {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({
    map: faceTexture,
    transparent: false,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), bodyMat);
  body.scale.set(1, 0.82, 1);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // little feet
  const footMat = new THREE.MeshLambertMaterial({ color: 0xff9ec4 });
  for (const sx of [-0.25, 0.25]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), footMat);
    foot.scale.set(1, 0.6, 1.2);
    foot.position.set(sx, 0.12, 0.18);
    group.add(foot);
  }

  return { group, body };
}
