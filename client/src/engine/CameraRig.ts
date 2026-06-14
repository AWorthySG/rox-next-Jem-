import * as THREE from "three";

// Third-person follow camera with mouse-wheel zoom and optional drag-orbit.
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3(0, 1, 0);
  private distance = 18;
  private minDist = 8;
  private maxDist = 40;
  private yaw = 0; // orbit angle around target
  private pitch = 0.85; // radians above horizon
  private dragging = false;
  private lastX = 0;
  private shakeAmt = 0;

  constructor(private dom: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);

    dom.addEventListener("wheel", (e) => {
      this.distance = THREE.MathUtils.clamp(this.distance + Math.sign(e.deltaY) * 2, this.minDist, this.maxDist);
    });
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
    dom.addEventListener("pointerdown", (e) => {
      if (e.button === 2) {
        this.dragging = true;
        this.lastX = e.clientX;
      }
    });
    window.addEventListener("pointerup", () => (this.dragging = false));
    window.addEventListener("pointermove", (e) => {
      if (this.dragging) {
        this.yaw -= (e.clientX - this.lastX) * 0.006;
        this.lastX = e.clientX;
      }
    });
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  // Add an impulse of camera shake (e.g. on a crit or taking a hit).
  shake(amount: number): void {
    this.shakeAmt = Math.min(0.9, this.shakeAmt + amount);
  }

  // Smoothly follow a world position.
  follow(pos: THREE.Vector3, dt: number): void {
    this.target.lerp(new THREE.Vector3(pos.x, pos.y + 1, pos.z), Math.min(1, dt * 8));
    const horiz = Math.cos(this.pitch) * this.distance;
    const height = Math.sin(this.pitch) * this.distance;
    const desired = new THREE.Vector3(
      this.target.x + Math.sin(this.yaw) * horiz,
      this.target.y + height,
      this.target.z + Math.cos(this.yaw) * horiz,
    );
    this.camera.position.lerp(desired, Math.min(1, dt * 8));
    if (this.shakeAmt > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.z += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.pow(0.0001, dt); // fast exponential decay
    }
    this.camera.lookAt(this.target);
  }
}
