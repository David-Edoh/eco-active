import { Entity, Vec3 } from "playcanvas";
import type { PlayerMovement } from "./PlayerMovement";
export class CameraFollow {
  yaw = 0.25;
  pitch = 0.22;
  distance = 6.5;
  private position = new Vec3();
  private target = new Vec3();
  private initialized = false;
  constructor(
    readonly entity: Entity,
    private collision: PlayerMovement,
  ) {}
  update(
    dt: number,
    x: number,
    y: number,
    z: number,
    lookX: number,
    lookY: number,
  ) {
    this.yaw -= lookX * 0.004;
    this.pitch = Math.max(-0.08, Math.min(0.85, this.pitch + lookY * 0.003));
    this.target.set(x, y + 1.4, z);
    let distance = this.distance;
    for (let d = 1; d < this.distance; d += 0.4) {
      const cx = x + Math.sin(this.yaw) * d,
        cz = z + Math.cos(this.yaw) * d;
      if (!this.collision.canMove(cx, cz, 0.25)) {
        distance = Math.max(1, d - 0.5);
        break;
      }
    }
    const px = x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      py = y + 1.7 + Math.sin(this.pitch) * distance,
      pz = z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance;
    const alpha = this.initialized ? 1 - Math.exp(-12 * dt) : 1;
    this.position.x += (px - this.position.x) * alpha;
    this.position.y += (py - this.position.y) * alpha;
    this.position.z += (pz - this.position.z) * alpha;
    this.initialized = true;
    this.entity.setPosition(this.position);
    this.entity.lookAt(this.target);
  }
}
