import * as THREE from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { MAP_SIZE, type MapTheme } from "@rox/shared";
import { makeGroundTexture, makeGroundRoughness, makeSunSprite, makeCloud, makeSpark } from "../procedural/textures.js";
import { buildScenery, type Scenery } from "../procedural/scenery.js";
import { buildWater, type Water } from "../procedural/water.js";

// Owns the renderer, the CSS2D label layer, scene, lights, ground, sky dome and
// the post-processing pipeline (bloom + SMAA), styled for a warm anime-MMO look.
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly ground: THREE.Mesh;
  private sky: THREE.Mesh;
  private skyUniforms: Record<string, THREE.IUniform>;
  private sun: THREE.DirectionalLight;
  private sunSprite: THREE.Sprite;
  private hemi: THREE.HemisphereLight;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scenery: Scenery | null = null;
  private water: Water | null = null;
  private clouds: THREE.Sprite[] = [];
  private motes!: THREE.Points;
  private moteBox = 34;
  private clock = new THREE.Clock();

  constructor(root: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    root.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    const layer = this.labelRenderer.domElement;
    layer.className = "label-layer";
    root.appendChild(layer);

    this.scene.fog = new THREE.Fog(0xbfd8ef, MAP_SIZE * 0.55, MAP_SIZE * 1.25);

    // ---- lighting: warm key sun + cool sky fill + a subtle rim ----
    this.hemi = new THREE.HemisphereLight(0xdcefff, 0x55663a, 0.85);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.0);
    this.sun.position.set(46, 78, 34);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const s = MAP_SIZE * 0.62;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const rim = new THREE.DirectionalLight(0x9fc2ff, 0.5);
    rim.position.set(-40, 30, -50);
    this.scene.add(rim);

    // ---- gradient sky dome (shader) + glowing sun sprite ----
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x2f6fc0) },
      midColor: { value: new THREE.Color(0x9fc6ec) },
      bottomColor: { value: new THREE.Color(0xeaf3fb) },
      offset: { value: 8 },
      exponent: { value: 0.7 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(MAP_SIZE * 1.4, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
      }),
    );
    this.scene.add(this.sky);

    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeSunSprite(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
    );
    this.sunSprite.scale.setScalar(46);
    this.sunSprite.position.copy(this.sun.position).multiplyScalar(1.7);
    this.scene.add(this.sunSprite);

    // ---- ground: PBR grass with a roughness map ----
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_SIZE * 1.04, MAP_SIZE * 1.04, 1, 1),
      new THREE.MeshStandardMaterial({
        map: makeGroundTexture(),
        roughnessMap: makeGroundRoughness(),
        roughness: 1,
        metalness: 0,
        color: 0xffffff,
      }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // soft border ring so players see the map edge
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(MAP_SIZE * 0.5 - 1.2, MAP_SIZE * 0.5, 96),
      new THREE.MeshBasicMaterial({ color: 0x223018, side: THREE.DoubleSide, transparent: true, opacity: 0.45 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    // ---- post-processing ----
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, undefined as unknown as THREE.Camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, // strength
      0.7, // radius
      0.82, // threshold — only bright things bloom
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // Cinematic grade: gentle saturation + contrast lift and a soft vignette.
    this.composer.addPass(new ShaderPass(GRADE_SHADER));
    const smaa = new SMAAPass(window.innerWidth, window.innerHeight);
    this.composer.addPass(smaa);

    this.scenery = buildScenery("field");
    this.scene.add(this.scenery.group);

    // ---- drifting cloud layer ----
    const cloudTex = makeCloud();
    for (let i = 0; i < 10; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      const size = 30 + Math.random() * 40;
      sprite.scale.set(size, size * 0.55, 1);
      sprite.position.set((Math.random() - 0.5) * MAP_SIZE * 2.2, 45 + Math.random() * 25, (Math.random() - 0.5) * MAP_SIZE * 2.2);
      this.scene.add(sprite);
      this.clouds.push(sprite);
    }

    // ---- ambient floating motes (follow the camera for constant density) ----
    const count = 140;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.moteBox;
      positions[i * 3 + 1] = Math.random() * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.moteBox;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        map: makeSpark(),
        color: 0xfff2cf,
        size: 0.22,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      }),
    );
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);

    window.addEventListener("resize", () => this.onResize());
  }

  // Recolor the world for a different map (tint ground/sky, change fog, reseed props).
  setTheme(theme: MapTheme, mapId: string): void {
    (this.ground.material as THREE.MeshStandardMaterial).color.setHex(theme.ground);
    this.skyUniforms.topColor.value.setHex(theme.sky).multiplyScalar(0.8);
    this.skyUniforms.midColor.value.setHex(theme.sky);
    this.skyUniforms.bottomColor.value.setHex(theme.fog).lerp(new THREE.Color(0xffffff), 0.35);
    (this.scene.fog as THREE.Fog).color.setHex(theme.fog);
    (this.sunSprite.material as THREE.SpriteMaterial).color.setHex(theme.sky).lerp(new THREE.Color(0xffffff), 0.7);

    if (this.scenery) {
      this.scene.remove(this.scenery.group);
      this.scenery.dispose();
    }
    this.scenery = buildScenery(mapId);
    this.scene.add(this.scenery.group);

    // ocean surrounding the island, on coastal/lake maps only
    if (this.water) {
      this.scene.remove(this.water.mesh);
      this.water.dispose();
      this.water = null;
    }
    const w = WATER_MAPS[mapId];
    if (w) {
      this.water = buildWater(w[0], w[1]);
      this.scene.add(this.water.mesh);
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  render(camera: THREE.Camera): void {
    const dt = this.clock.getDelta();
    const edge = MAP_SIZE * 1.1;
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.4;
      if (cloud.position.x > edge) cloud.position.x = -edge;
    }
    // motes: keep the cloud centred on the camera and drift each particle up,
    // wrapping within the local box so density stays constant everywhere.
    this.motes.position.set(camera.position.x, 0, camera.position.z);
    const pos = this.motes.geometry.getAttribute("position") as THREE.BufferAttribute;
    const half = this.moteBox / 2;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.5;
      let x = pos.getX(i) + dt * 0.3;
      if (y > 14) y -= 14;
      if (x > half) x -= this.moteBox;
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
    if (this.water) this.water.material.uniforms.time.value += dt;
    (this.composer.passes[0] as RenderPass).camera = camera;
    this.composer.render();
    this.labelRenderer.render(this.scene, camera);
  }
}

// Final colour grade: saturation, contrast and a soft vignette for depth.
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    saturation: { value: 1.14 },
    contrast: { value: 1.06 },
    vignette: { value: 0.42 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // contrast around mid-grey
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      // saturation toward luminance
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      // vignette
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * vignette * 2.4;
      c.rgb *= clamp(v, 0.0, 1.0);
      gl_FragColor = c;
    }
  `,
};

// Maps that get an ocean around the island: [shallow, deep] water colours.
const WATER_MAPS: Record<string, [number, number]> = {
  comodo: [0x6fd0e0, 0x12586f],
  abyss: [0x3a8fb0, 0x081f2e],
  merlion_bay: [0x7fdce8, 0x1a6a8a],
  sentosa: [0x7fe0e8, 0x1a7090],
  east_coast: [0x7fd8e0, 0x1a6884],
};

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    float t = max(pow(max(h, 0.0), exponent), 0.0);
    vec3 lower = mix(bottomColor, midColor, smoothstep(0.0, 0.35, h));
    vec3 col = mix(lower, topColor, t);
    gl_FragColor = vec4(col, 1.0);
  }
`;
