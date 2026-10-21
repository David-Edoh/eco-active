export class InputController {
  readonly keys = new Set<string>();
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  sprint = false;
  jump = false;
  private dragging = false;
  private listeners = new AbortController();
  constructor(
    private canvas: HTMLCanvasElement,
    private onPause: () => void,
  ) {
    const options = { signal: this.listeners.signal };
    window.addEventListener(
      "keydown",
      (e) => {
        if ((e.target as HTMLElement)?.matches("input,textarea")) return;
        if (
          ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            e.code,
          )
        )
          e.preventDefault();
        this.keys.add(e.code);
        if (e.code === "Space") this.jump = true;
        if (e.code === "Escape") onPause();
      },
      options,
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), options);
    window.addEventListener("blur", () => this.clear(), options);
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "mouse") {
          this.dragging = true;
          canvas.setPointerCapture(e.pointerId);
        }
      },
      options,
    );
    canvas.addEventListener(
      "pointerup",
      () => {
        this.dragging = false;
      },
      options,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (this.dragging || document.pointerLockElement === canvas) {
          this.lookX += e.movementX;
          this.lookY += e.movementY;
        }
      },
      options,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), options);
  }
  get x() {
    return (
      this.moveX +
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0)
    );
  }
  get y() {
    return (
      this.moveY +
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0)
    );
  }
  get running() {
    return (
      this.sprint || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")
    );
  }
  clear() {
    this.keys.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.jump = false;
    this.sprint = false;
    this.dragging = false;
  }
  destroy() {
    this.clear();
    this.listeners.abort();
  }
}
