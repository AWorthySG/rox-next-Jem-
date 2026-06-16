import * as THREE from "three";

// Anime-style rim light for toon materials: a soft view-dependent fresnel glow
// on silhouette edges, added to the material's emissive so it reads as a bright
// rim catching the sky. Injected via onBeforeCompile, so it composes with the
// existing cel shading + outline. If a future three version renames the inject
// point the replace simply no-ops (no rim, no breakage).
//
// Shared, subtle defaults — cool sky-rim at low strength so it lifts edges
// without blowing out under bloom.
const RIM_COLOR = new THREE.Color(0xbfe0ff);
const RIM_STRENGTH = 0.22;
const RIM_POWER = 2.6;

const tagged = new WeakSet<THREE.Material>();

export function applyRimLight(
  mat: THREE.MeshToonMaterial,
  color: THREE.Color = RIM_COLOR,
  strength = RIM_STRENGTH,
): void {
  if (tagged.has(mat)) return;
  tagged.add(mat);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.rimColor = { value: color };
    shader.uniforms.rimStrength = { value: strength };
    shader.uniforms.rimPower = { value: RIM_POWER };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;\nvoid main() {",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), rimPower);
         totalEmissiveRadiance += rimColor * rim * rimStrength;`,
      );
  };
  mat.needsUpdate = true;
}
