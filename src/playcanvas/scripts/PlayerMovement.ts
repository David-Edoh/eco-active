import type { GameEntity } from "../ecs/components";
import type { District } from "../types";
import type { InputController } from "../controllers/InputController";
export class PlayerMovement {
  private vertical = 0;
  private collisionGrid = new Map<string, District["buildings"]>();
  constructor(private district: District) {
    for (const b of [
      ...district.buildings,
      ...(district.stalls ?? []),
      ...(district.parkedVehicles ?? []),
    ]) {
      const r = Math.hypot(b.w ?? 0, b.d ?? 0) / 2 + 1;
      for (
        let x = Math.floor((b.x - r) / 20);
        x <= Math.floor((b.x + r) / 20);
        x++
      )
        for (
          let z = Math.floor((b.z - r) / 20);
          z <= Math.floor((b.z + r) / 20);
          z++
        ) {
          const key = `${x}:${z}`;
          if (!this.collisionGrid.has(key)) this.collisionGrid.set(key, []);
          this.collisionGrid.get(key)!.push(b);
        }
    }
  }
  canMove(x: number, z: number, r = 0.4) {
    if (Math.hypot((x + 24) / 1.6, z + 4) < 5 + r) return false;
    if (
      Math.abs(x) > this.district.bounds ||
      Math.abs(z) > this.district.bounds
    )
      return false;
    for (const b of this.collisionGrid.get(
      `${Math.floor(x / 20)}:${Math.floor(z / 20)}`,
    ) ?? []) {
      const a = (-b.yaw * Math.PI) / 180,
        c = Math.cos(a),
        s = Math.sin(a),
        dx = x - b.x,
        dz = z - b.z;
      const localX = dx * c + dz * s,
        localZ = -dx * s + dz * c;
      if (
        Math.abs(localX) < (b.w ?? 0) / 2 + r &&
        Math.abs(localZ) < (b.d ?? 0) / 2 + r
      )
        return false;
    }
    return true;
  }
  update(entity: GameEntity, input: InputController, yaw: number, dt: number) {
    const p = entity.position!;
    let x = input.x,
      z = input.y;
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    const speed = input.running ? 7 : 3.2;
    const vx = (Math.cos(yaw) * x - Math.sin(yaw) * z) * speed,
      vz = (-Math.sin(yaw) * x - Math.cos(yaw) * z) * speed;
    const nx = p.x + vx * dt,
      nz = p.z + vz * dt;
    if (this.canMove(nx, p.z)) p.x = nx;
    if (this.canMove(p.x, nz)) p.z = nz;
    entity.moving = length > 0.05;
    if (entity.moving) entity.yaw = (Math.atan2(vx, vz) * 180) / Math.PI;
    if (input.jump && p.y <= 0.17) this.vertical = 5;
    input.jump = false;
    this.vertical -= 14 * dt;
    p.y = Math.max(0.16, p.y + this.vertical * dt);
    if (p.y === 0.16) this.vertical = 0;
  }
}
