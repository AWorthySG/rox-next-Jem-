import * as THREE from "three";
import { makeBlobShadow, makeToonGradient } from "./textures.js";

export interface PoringMesh {
  group: THREE.Group;
  body: THREE.Mesh;
}

// A Poring: a glossy squashed jelly sphere wearing its face texture, with a
// toon-shaded body, a highlight glint, stubby feet and a soft contact shadow.
export function buildPoring(faceTexture: THREE.Texture): PoringMesh {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshToonMaterial({
    map: faceTexture,
    gradientMap: makeToonGradient(),
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), bodyMat);
  body.scale.set(1, 0.82, 1);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  // jelly highlight glint (top-left), subtle and additive
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glint.position.set(-0.22, 0.78, 0.34);
  glint.scale.set(1.4, 0.8, 0.5);
  group.add(glint);

  // little feet
  const footMat = new THREE.MeshToonMaterial({ color: 0xff9ec4, gradientMap: makeToonGradient() });
  for (const sx of [-0.25, 0.25]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), footMat);
    foot.scale.set(1, 0.6, 1.2);
    foot.position.set(sx, 0.12, 0.18);
    foot.castShadow = true;
    group.add(foot);
  }

  // soft contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshBasicMaterial({ map: makeBlobShadow(), transparent: true, depthWrite: false, opacity: 0.65 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return { group, body };
}
