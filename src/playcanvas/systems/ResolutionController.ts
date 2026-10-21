import type { Application } from "playcanvas";
import type { Quality } from "../types";
export class ResolutionController {
  scale = 1;
  quality: Quality = "auto";
  private elapsed = 0;
  private average = 16.7;
  constructor(
    private app: Application,
    private canvas: HTMLCanvasElement,
  ) {
    this.scale = matchMedia("(pointer:coarse)").matches ? 0.85 : 1;
    this.resize();
  }
  resize() {
    const max = this.quality === "high" ? 1.5 : 1.25;
    this.app.graphicsDevice.maxPixelRatio =
      Math.min(devicePixelRatio, max) * this.scale;
    this.app.resizeCanvas(this.canvas.clientWidth, this.canvas.clientHeight);
  }
  setQuality(quality: Quality) {
    this.quality = quality;
    this.scale = quality === "low" ? 0.65 : 1;
    this.resize();
  }
  update(dt: number) {
    this.average = this.average * 0.96 + dt * 1000 * 0.04;
    this.elapsed += dt;
    if (this.elapsed < 3 || this.quality !== "auto") return;
    this.elapsed = 0;
    const next =
      this.average > 22
        ? Math.max(0.6, this.scale - 0.1)
        : this.average < 17
          ? Math.min(1, this.scale + 0.05)
          : this.scale;
    if (next !== this.scale) {
      this.scale = next;
      this.resize();
    }
  }
}
