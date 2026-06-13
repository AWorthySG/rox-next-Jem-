import * as THREE from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { MAP_SIZE, type MapTheme } from "@rox/shared";
import { makeGrassTexture, makeSkyTexture } from "../procedural/textures.js";

// Owns the renderer, the CSS2D label layer, scene, lights, ground and sky dome.
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly ground: THREE.Mesh;
  private sky: THREE.Mesh;

  constructor(root: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    const layer = this.labelRenderer.domElement;
    layer.className = "label-layer";
    root.appendChild(layer);

    this.scene.fog = new THREE.Fog(0xbfd8ef, MAP_SIZE * 0.5, MAP_SIZE * 1.1);

    // ---- lighting ----
    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a6b3a, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    sun.position.set(40, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = MAP_SIZE * 0.6;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = 220;
    this.scene.add(sun);

    // ---- sky dome ----
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(MAP_SIZE * 0.95, 32, 16),
      new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
    );
    this.scene.add(this.sky);

    // ---- ground ----
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 1, 1),
      new THREE.MeshLambertMaterial({ map: makeGrassTexture() }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // soft border ring so players see the map edge
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(MAP_SIZE * 0.5 - 1, MAP_SIZE * 0.5, 64),
      new THREE.MeshBasicMaterial({ color: 0x2c3a1f, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    window.addEventListener("resize", () => this.onResize());
  }

  // Recolor the world for a different map (tint ground/sky, change fog).
  setTheme(theme: MapTheme): void {
    (this.ground.material as THREE.MeshLambertMaterial).color.setHex(theme.ground);
    (this.sky.material as THREE.MeshBasicMaterial).color.setHex(theme.sky);
    (this.scene.fog as THREE.Fog).color.setHex(theme.fog);
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
    this.labelRenderer.render(this.scene, camera);
  }
}
