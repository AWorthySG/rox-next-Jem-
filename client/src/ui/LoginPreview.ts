import * as THREE from "three";
import { isMagicJob, jobFamilyOf, JobId } from "@rox/shared";
import { applyHeadgear, buildCharacter, setEyeBlink, type CharacterMesh, type WeaponStyle } from "../procedural/characterMesh.js";

// Per-job outfit hue + a flashy starter hat so the login preview reads distinct.
const JOB_LOOK: Record<string, { hue: number; hat: string }> = {
  novice: { hue: 200, hat: "feather_beret" },
  swordsman: { hue: 8, hat: "valkyrie_helm" },
  mage: { hue: 220, hat: "apprentice_circlet" },
  archer: { hue: 110, hat: "feather_beret" },
  acolyte: { hue: 48, hat: "gem_crown" },
};

// A small self-contained 3D scene shown on the login card: a slowly turning,
// cel-shaded character that updates with the selected class. Its own tiny
// renderer; stops when the player enters the world to free the GPU loop.
export class LoginPreview {
  private container = document.getElementById("login-preview")!;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private char: CharacterMesh | null = null;
  private holder = new THREE.Group();
  private raf = 0;
  private running = false;
  private spin = 0;
  private blinkIn = 2;
  private blinkT = 0;

  constructor() {
    const w = this.container.clientWidth || 280;
    const h = this.container.clientHeight || 200;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    this.camera.position.set(0, 1.25, 3.4);
    this.camera.lookAt(0, 0.92, 0);

    this.scene.add(new THREE.HemisphereLight(0xdcefff, 0x404858, 1.0));
    const key = new THREE.DirectionalLight(0xfff0d2, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88b0ff, 1.2);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);

    // a soft round pedestal
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.2, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.7, metalness: 0.2 }),
    );
    disc.position.y = -0.06;
    this.scene.add(disc);
    // glowing rim ring on the pedestal so the pick screen feels like a stage
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.14, 0.035, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x8ad0ff }),
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.02;
    this.scene.add(glowRing);
    this.scene.add(this.holder);

    this.setJob(JobId.Novice);
    window.addEventListener("resize", () => this.resize());
  }

  setJob(job: JobId): void {
    if (this.char) {
      this.holder.remove(this.char.group);
      this.char.group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
      });
    }
    const look = JOB_LOOK[job] ?? JOB_LOOK.novice;
    const fam = jobFamilyOf(job);
    const weapon: WeaponStyle = fam === "mage" ? "staff" : fam === "archer" ? "bow" : fam === "acolyte" ? "mace" : "blade";
    this.char = buildCharacter(look.hue, isMagicJob(job), weapon);
    applyHeadgear(this.char, look.hat);
    this.holder.add(this.char.group);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.spin += 0.01;
      this.holder.rotation.y = Math.sin(this.spin) * 0.6 + this.spin * 0.15;
      this.holder.position.y = Math.sin(this.spin * 2) * 0.03;
      // preview blink, matching the in-game chibi charm (~60fps ticks)
      this.blinkIn -= 1 / 60;
      if (this.blinkIn <= 0) {
        this.blinkIn = 1.5 + Math.random() * 3.5;
        this.blinkT = 0.13;
      }
      if (this.blinkT > 0 && this.char) {
        this.blinkT -= 1 / 60;
        setEyeBlink(this.char, this.blinkT > 0 ? 0.08 : 1);
      }
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
