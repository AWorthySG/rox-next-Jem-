import * as THREE from "three";

export interface InputHandlers {
  onMoveTo(x: number, z: number): void;
  onAttack(entityId: number): void;
}

// Translates left-clicks into intents: clicking a monster attacks it, clicking
// the ground issues a move order. Picking uses raycasting.
export class InputController {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  constructor(
    private dom: HTMLElement,
    private camera: THREE.Camera,
    private ground: THREE.Object3D,
    private getPickables: () => THREE.Object3D[],
    private handlers: InputHandlers,
  ) {
    this.dom.addEventListener("pointerdown", (e) => this.onPointerDown(e));
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // left click only
    this.ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);

    // Entities first.
    const picks = this.raycaster.intersectObjects(this.getPickables(), true);
    if (picks.length > 0) {
      const id = findEntityId(picks[0].object);
      if (id != null) {
        this.handlers.onAttack(id);
        return;
      }
    }
    // Otherwise move to the clicked ground point.
    const hit = this.raycaster.intersectObject(this.ground, false);
    if (hit.length > 0) {
      const p = hit[0].point;
      this.handlers.onMoveTo(p.x, p.z);
    }
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
