import * as THREE from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { MAP_SIZE, DAY_LENGTH_MS, daylight, Weather, type MapTheme } from "@rox/shared";
import { makeGroundTexture, makeGroundRoughness, makeSunSprite, makeCloud, makeSpark, makeCloudShadow } from "../procedural/textures.js";
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
  private stars!: THREE.Points;
  private moon!: THREE.Sprite;
  private cloudShadow!: THREE.Mesh;
  private hemi: THREE.HemisphereLight;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private scenery: Scenery | null = null;
  private water: Water | null = null;
  private clouds: THREE.Sprite[] = [];
  private motes!: THREE.Points;
  private moteBox = 34;
  private clock = new THREE.Clock();

  // ---- day/night + weather ----
  private themeSky = new THREE.Color(0x9fc6ec);
  private themeFog = new THREE.Color(0xbfd8ef);
  private themeGround = new THREE.Color(0xffffff);
  private envTime = 0.4; // displayed time of day (0..1), eased toward the server's
  private envTargetTime = 0.4;
  private weather: Weather = Weather.Clear;
  private precip: THREE.Points | null = null; // rain/snow particle layer
  private precipBox = 80;

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

    // ---- night sky: starfield + moon (fade in after dusk) ----
    const starR = MAP_SIZE * 1.32;
    const starCount = 420;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.15, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(starR);
      starPos[i * 3] = dir.x;
      starPos[i * 3 + 1] = dir.y;
      starPos[i * 3 + 2] = dir.z;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        map: makeSpark(),
        color: 0xfff4e0,
        size: 2.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.stars.visible = false;
    this.scene.add(this.stars);

    this.moon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeSunSprite(), color: 0xcfe0ff, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
    );
    this.moon.scale.setScalar(30);
    this.moon.position.set(-40, 70, -60).multiplyScalar(1.7);
    this.moon.visible = false;
    this.scene.add(this.moon);

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

    // ---- drifting cloud shadows: dappled sunlight that scrolls over the ground ----
    const csTex = makeCloudShadow();
    csTex.repeat.set(2.5, 2.5);
    this.cloudShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_SIZE * 1.04, MAP_SIZE * 1.04),
      new THREE.MeshBasicMaterial({ map: csTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.16 }),
    );
    this.cloudShadow.rotation.x = -Math.PI / 2;
    this.cloudShadow.position.y = 0.06;
    this.cloudShadow.renderOrder = 1; // over the ground, before entities
    this.scene.add(this.cloudShadow);

    // ---- post-processing ----
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, undefined as unknown as THREE.Camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.62, // strength — a touch dreamier glow on highlights
      0.8, // radius — softer falloff
      0.8, // threshold — only bright things bloom
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // Cinematic grade: saturation + contrast, warm/cool split-tone, soft vignette,
    // and a hint of animated film grain for richness.
    this.grade = new ShaderPass(GRADE_SHADER);
    this.composer.addPass(this.grade);
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
    // Store the map's daytime palette; applyEnvironment() blends it with the
    // current time-of-day and weather.
    this.themeGround.setHex(theme.ground);
    this.themeSky.setHex(theme.sky);
    this.themeFog.setHex(theme.fog);
    this.applyEnvironment();

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

  // Sync the global sky state from the server (time-of-day + weather).
  setEnvironment(timeOfDay: number, weather: Weather): void {
    this.envTargetTime = timeOfDay;
    if (weather !== this.weather) {
      this.weather = weather;
      this.buildWeather();
    }
    this.applyEnvironment();
  }

  // Blend the map's daytime palette with the current sun position + weather:
  // dims and blues the sky/fog/ground at night, dims further when overcast,
  // and scales the sun/hemisphere lights to match.
  private applyEnvironment(): void {
    const d = daylight(this.envTime); // 0 at night → 1 at noon
    const overcast =
      this.weather === Weather.Storm ? 0.45 :
      this.weather === Weather.Rain ? 0.7 :
      this.weather === Weather.Snow ? 0.78 :
      this.weather === Weather.Fog ? 0.62 : 1;
    const bright = (0.22 + 0.78 * d) * overcast;

    // Reused scratch constants (no per-frame allocation — this runs every frame).
    const nightSky = ENV_NIGHT_SKY;
    const nightFog = ENV_NIGHT_FOG;
    const white = ENV_WHITE;

    this.skyUniforms.topColor.value.copy(this.themeSky).multiplyScalar(0.8).lerp(nightSky, 1 - d).multiplyScalar(overcast);
    this.skyUniforms.midColor.value.copy(this.themeSky).lerp(nightSky, 1 - d).multiplyScalar(overcast);
    this.skyUniforms.bottomColor.value.copy(this.themeFog).lerp(white, 0.35).lerp(nightFog, 1 - d).multiplyScalar(overcast);

    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.themeFog).lerp(nightFog, 1 - d).multiplyScalar(overcast);
    const dense =
      this.weather === Weather.Fog ? 0.34 :
      this.weather === Weather.Storm ? 0.55 :
      this.weather === Weather.Rain || this.weather === Weather.Snow ? 0.72 : 1;
    fog.near = MAP_SIZE * 0.55 * dense;
    fog.far = MAP_SIZE * 1.25 * dense;

    (this.ground.material as THREE.MeshStandardMaterial).color.copy(this.themeGround).multiplyScalar(0.45 + 0.55 * bright);

    this.sun.intensity = 0.25 + 2.0 * d * overcast;
    this.hemi.intensity = 0.3 + 0.6 * bright;
    const sprite = this.sunSprite.material as THREE.SpriteMaterial;
    sprite.color.copy(this.themeSky).lerp(white, 0.7);
    sprite.opacity = Math.max(0, d * overcast);
    this.sunSprite.visible = d > 0.05 && overcast > 0.6;

    // dappled cloud shadows only make sense in daylight; dim them under overcast
    const cs = this.cloudShadow.material as THREE.MeshBasicMaterial;
    cs.opacity = d * 0.18 * overcast;
    this.cloudShadow.visible = cs.opacity > 0.01;

    // night sky: stars + moon fade in as the sun sets (and dim under overcast)
    const night = (1 - d) * overcast;
    (this.stars.material as THREE.PointsMaterial).opacity = night * 0.9;
    this.stars.visible = night > 0.04;
    (this.moon.material as THREE.SpriteMaterial).opacity = night * 0.8;
    this.moon.visible = night > 0.04;
  }

  // Rebuild the falling rain/snow particle layer for the current weather.
  private buildWeather(): void {
    if (this.precip) {
      this.scene.remove(this.precip);
      this.precip.geometry.dispose();
      (this.precip.material as THREE.Material).dispose();
      this.precip = null;
    }
    const w = this.weather;
    if (w !== Weather.Rain && w !== Weather.Storm && w !== Weather.Snow) return;
    const snow = w === Weather.Snow;
    const count = snow ? 900 : 1500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.precipBox;
      positions[i * 3 + 1] = Math.random() * 44;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.precipBox;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.precip = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: makeSpark(),
        color: snow ? 0xffffff : 0x9fc4ff,
        size: snow ? 0.55 : 0.34,
        transparent: true,
        opacity: snow ? 0.85 : 0.6,
        depthWrite: false,
        sizeAttenuation: true,
        fog: false,
        blending: snow ? THREE.NormalBlending : THREE.AdditiveBlending,
      }),
    );
    this.precip.frustumCulled = false;
    this.scene.add(this.precip);
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

    // advance the local day clock at the server's rate, then ease toward the
    // latest server time along the shortest path (handles midnight wrap).
    this.envTime = (this.envTime + dt / (DAY_LENGTH_MS / 1000)) % 1;
    let diff = this.envTargetTime - this.envTime;
    if (diff > 0.5) diff -= 1;
    else if (diff < -0.5) diff += 1;
    this.envTime = (this.envTime + diff * Math.min(1, dt * 0.5) + 1) % 1;
    this.applyEnvironment();

    // falling rain / snow, kept centred on the camera
    if (this.precip) {
      this.precip.position.set(camera.position.x, 0, camera.position.z);
      const snow = this.weather === Weather.Snow;
      const speed = snow ? 6 : 40;
      const pp = this.precip.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) {
        let y = pp.getY(i) - dt * speed;
        if (y < 0) y += 44;
        pp.setY(i, y);
        if (snow) pp.setX(i, pp.getX(i) + Math.sin((y + i) * 0.6) * dt * 1.4);
      }
      pp.needsUpdate = true;
    }

    // slowly drift the cloud shadows across the ground
    const csMap = (this.cloudShadow.material as THREE.MeshBasicMaterial).map;
    if (csMap) {
      csMap.offset.x += dt * 0.01;
      csMap.offset.y += dt * 0.004;
    }
    if (this.water) this.water.material.uniforms.time.value += dt;
    this.grade.uniforms.time.value += dt;
    (this.composer.passes[0] as RenderPass).camera = camera;
    this.composer.render();
    this.labelRenderer.render(this.scene, camera);
  }
}

// Final colour grade: saturation + contrast, a warm/cool split-tone, a soft
// vignette, and a hint of animated film grain for a richer cinematic look.
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    saturation: { value: 1.16 },
    contrast: { value: 1.07 },
    vignette: { value: 0.42 },
    time: { value: 0 },
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
    uniform float time;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // contrast around mid-grey
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      // saturation toward luminance
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      // split-tone: warm highlights, cool shadows (subtle, depth-enhancing)
      vec3 warm = vec3(1.05, 1.0, 0.93);
      vec3 cool = vec3(0.95, 0.99, 1.06);
      c.rgb *= mix(cool, warm, smoothstep(0.25, 0.85, l));
      // soft vignette with a floor so corners aren't crushed black
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * vignette * 2.4;
      c.rgb *= clamp(vig, 0.6, 1.0);
      // faint animated film grain
      float g = hash(vUv * 1024.0 + fract(time)) - 0.5;
      c.rgb += g * 0.022;
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
  changi: [0x7fdce4, 0x1a6a88],
  macritchie: [0x4a9a6a, 0x14483a],
  sungei_buloh: [0x6a9a6a, 0x244a2a],
  kusu_island: [0x7fe0e8, 0x1a7090],
  botanic_gardens: [0x6abada, 0x1e5a7a],
  labrador_park: [0x7fd0e0, 0x1a6080],
  coney_island: [0x7fd8d8, 0x1e6470],
  punggol_waterway: [0x6fc8d0, 0x1a5a78],
  pasir_ris: [0x7fd8d0, 0x1e6470],
  marina_barrage: [0x6fb0d0, 0x143a5a],
  the_float: [0x5a9ad0, 0x0a2a5a],
};

// Shared, read-only colour targets for day/night blending (never mutated, so a
// single instance is reused every frame to avoid GC churn).
const ENV_NIGHT_SKY = new THREE.Color(0x0b1a3a);
const ENV_NIGHT_FOG = new THREE.Color(0x10182e);
const ENV_WHITE = new THREE.Color(0xffffff);

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
