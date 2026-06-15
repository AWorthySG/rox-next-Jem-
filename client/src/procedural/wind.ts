import * as THREE from "three";

// Gentle wind sway for instanced foliage (tree canopies + grass tufts). A single
// shared time uniform drives every windy material; SceneManager advances it each
// frame. Vertices are displaced more the higher they are, so canopies nod while
// trunks/bases stay planted. Injected via onBeforeCompile; a renamed inject point
// would simply no-op (no sway, no breakage).

export const windTime = { value: 0 };

const tagged = new WeakSet<THREE.Material>();

export function applyWind(mat: THREE.Material, strength = 0.05): void {
  if (tagged.has(mat)) return;
  tagged.add(mat);
  const prev = (mat as THREE.MeshStandardMaterial).onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.windTime = windTime;
    shader.uniforms.windStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        "uniform float windTime;\nuniform float windStrength;\nvoid main() {",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 instPos = instanceMatrix[3].xyz;
         #else
           vec3 instPos = vec3(0.0);
         #endif
         float ph = instPos.x * 0.35 + instPos.z * 0.35;
         float wind = sin(windTime * 1.5 + ph) + 0.4 * sin(windTime * 2.7 + ph * 1.7);
         float sway = wind * windStrength * clamp(transformed.y, 0.0, 3.0);
         transformed.x += sway;
         transformed.z += sway * 0.5;`,
      );
  };
  mat.needsUpdate = true;
}
