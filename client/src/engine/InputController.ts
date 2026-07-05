import * as THREE from "three";

export interface InputHandlers {
  onMoveTo(x: number, z: number): void;
  onAttack(entityId: number, shiftKey: boolean): void;
}

// Translates left-clicks into intents: clicking a monster attacks it, clicking
// the ground issues a move order. Holding the button over the ground steers
// continuously toward the cursor (smooth navigation). Picking uses raycasting.
export class InputController {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private holdMove = false;
  private cursorX = 0;
  private cursorY = 0;
  private lastSent = 0;
  private lastX = 0;
  private lastZ = 0;

  constructor(
    private dom: HTMLElement,
    private camera: THREE.Camera,
    private ground: THREE.Object3D,
    private getPickables: () => THREE.Object3D[],
    private handlers: InputHandlers,
  ) {
    this.dom.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.dom.addEventListener("pointermove", (e) => {
      this.cursorX = e.clientX;
      this.cursorY = e.clientY;
    });
    // End the hold anywhere the button is released or focus is lost.
    window.addEventListener("pointerup", (e) => {
      if (e.button === 0) this.holdMove = false;
    });
    window.addEventListener("blur", () => (this.holdMove = false));
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // left click only
    this.cursorX = e.clientX;
    this.cursorY = e.clientY;

    // Entities first: clicking a monster/player attacks (no hold-move).
    const id = this.pickEntity(e.clientX, e.clientY);
    if (id != null) {
      this.holdMove = false;
      this.handlers.onAttack(id, e.shiftKey);
      return;
    }
    // Otherwise move to the clicked ground point and begin steering.
    const p = this.pickGround(e.clientX, e.clientY);
    if (p) {
      this.holdMove = true;
      this.lastX = p.x;
      this.lastZ = p.z;
      this.lastSent = performance.now();
      this.handlers.onMoveTo(p.x, p.z);
    }
  }

  // Called each frame: while the button is held over the ground, keep steering
  // toward the cursor. Throttled to ~11 Hz (the sim tick) and to meaningful
  // movement so the network isn't spammed.
  update(): void {
    if (!this.holdMove) return;
    const now = performance.now();
    if (now - this.lastSent < 90) return;
    const p = this.pickGround(this.cursorX, this.cursorY);
    if (!p) return;
    if (Math.hypot(p.x - this.lastX, p.z - this.lastZ) < 0.4) return;
    this.lastX = p.x;
    this.lastZ = p.z;
    this.lastSent = now;
    this.handlers.onMoveTo(p.x, p.z);
  }

  private setRay(clientX: number, clientY: number): void {
    this.ndc.x = (clientX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private pickEntity(clientX: number, clientY: number): number | null {
    this.setRay(clientX, clientY);
    const picks = this.raycaster.intersectObjects(this.getPickables(), true);
    return picks.length > 0 ? findEntityId(picks[0].object) : null;
  }

  private pickGround(clientX: number, clientY: number): THREE.Vector3 | null {
    this.setRay(clientX, clientY);
    const hit = this.raycaster.intersectObject(this.ground, false);
    return hit.length > 0 ? hit[0].point : null;
  }
}

function findEntityId(obj: THREE.Object3D): number | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (typeof cur.userData?.entityId === "number") return cur.userData.entityId;
    cur = cur.parent;
  }
  return null;
}
