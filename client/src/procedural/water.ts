import * as THREE from "three";
import { MAP_SIZE } from "@rox/shared";

export interface Water {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  dispose(): void;
}

// A large animated water plane that sits just below the grass island so an ocean
// shows beyond the map edges. Custom shader: gentle waves, a sun glint, fresnel
// transparency and a sparkle — catches the scene's bloom on the highlights.
export function buildWater(shallow: number, deep: number): Water {
  const uniforms = {
    time: { value: 0 },
    shallow: { value: new THREE.Color(shallow) },
    deep: { value: new THREE.Color(deep) },
    sunDir: { value: new THREE.Vector3(0.5, 0.8, 0.35).normalize() },
    opacity: { value: 0.82 },
    shore: { value: MAP_SIZE * 0.5 }, // island half-extent, for shoreline foam
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE * 4, MAP_SIZE * 4, 64, 64), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.35;
  mesh.renderOrder = -1; // draw before entities
  return {
    mesh,
    material,
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

const VERT = /* glsl */ `
  uniform float time;
  varying vec3 vWorld;
  varying float vH;
  void main() {
    vec3 p = position;
    float h = sin(p.x * 0.18 + time * 1.2) * 0.18 + sin(p.y * 0.26 + time * 1.6) * 0.14;
    p.z += h;
    vH = h;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 shallow;
  uniform vec3 deep;
  uniform vec3 sunDir;
  uniform float opacity;
  uniform float time;
  uniform float shore;
  varying vec3 vWorld;
  varying float vH;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 3.0);
    vec3 col = mix(deep, shallow, clamp(vH * 2.2 + 0.5, 0.0, 1.0));
    // ripple-perturbed normal so the sun glint shimmers across the waves
    vec3 n = normalize(vec3(
      sin(vWorld.x * 0.6 + time * 1.3) * 0.07,
      1.0,
      sin(vWorld.z * 0.55 + time * 1.1) * 0.07
    ));
    vec3 refl = reflect(-sunDir, n);
    float glint = pow(max(dot(refl, viewDir), 0.0), 48.0);
    col += glint * 1.0;
    // drifting sparkle
    float spark = smoothstep(0.96, 1.0, sin(vWorld.x * 2.6 + time * 2.0) * sin(vWorld.z * 2.6 + time * 1.4));
    col += spark * 0.5;
    float a = mix(opacity, 1.0, fres);
    // animated foam where the ocean laps the island shore
    float edge = max(abs(vWorld.x), abs(vWorld.z));
    float band = smoothstep(shore + 2.0, shore, edge) * smoothstep(shore - 3.5, shore, edge);
    float fn = sin(vWorld.x * 1.4 + time * 2.4) * sin(vWorld.z * 1.6 - time * 2.0);
    float foam = band * smoothstep(0.15, 0.85, fn * 0.5 + 0.5);
    col = mix(col, vec3(1.0), foam * 0.75);
    a = max(a, foam * 0.9);
    gl_FragColor = vec4(col, a);
  }
`;
