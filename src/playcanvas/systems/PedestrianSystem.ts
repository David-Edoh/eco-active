import type { Application, Entity, RenderComponent } from "playcanvas";
import type { World } from "miniplex";
import type { GameEntity } from "../ecs/components";
import { AssetLibrary, NPC_CHARACTER_MODELS } from "../utils/assetLoader";
import { CharacterAnimator } from "./CharacterAnimator";
import type { District } from "../types";
import type { PlayerMovement } from "../scripts/PlayerMovement";
interface Pedestrian {
  entity: GameEntity;
  model?: Entity;
  animator?: CharacterAnimator;
  phase: number;
  variant: number;
}
export class PedestrianSystem {
  private people: Pedestrian[] = [];
  constructor(
    private app: Application,
    private assets: AssetLibrary,
    private world: World<GameEntity>,
    private collisions: PlayerMovement,
    district: District,
  ) {
    for (let i = 0; i < 12; i++) {
      const attendant = district.vendorAttendants?.[i];
      const x = attendant?.x ?? -65 + (i % 6) * 14,
        z = attendant?.z ?? 28 + Math.floor(i / 6) * 16;
      this.people.push({
        entity: world.add({
          id: `pedestrian-${i}`,
          npc: true,
          ...(attendant ? { vendor: { stallId: attendant.stallId } } : {}),
          position: { x, y: 0.16, z },
          yaw: attendant?.yaw ?? 90,
        }),
        phase: i,
        variant: i % NPC_CHARACTER_MODELS.length,
      });
    }
  }
  update(dt: number, x: number, z: number) {
    for (const p of this.people) {
      const pos = p.entity.position!;
      const near = Math.hypot(pos.x - x, pos.z - z) < 45;
      if (near && !p.model) {
        p.model = this.assets.instantiatePedestrian(p.variant);
        for (const r of p.model.findComponents("render") as RenderComponent[])
          r.castShadows = false;
        this.app.root.addChild(p.model);
        p.animator = new CharacterAnimator(
          p.model,
          this.assets.getAnimations(this.assets.pedestrianModel(p.variant)),
        );
      }
      if (!near && p.model) {
        p.model.destroy();
        p.model = undefined;
        p.animator = undefined;
      }
      if (!near) continue;
      if (p.entity.vendor) {
        p.model!.setPosition(pos.x, pos.y, pos.z);
        p.model!.setEulerAngles(0, p.entity.yaw ?? 0, 0);
        p.animator!.update(dt, false);
        continue;
      }
      p.phase += dt;
      const dir = Math.sin(p.phase * 0.12) > 0 ? 1 : -1;
      const nx = pos.x + dir * dt * 0.65;
      if (this.collisions.canMove(nx, pos.z)) pos.x = nx;
      else p.phase += 20;
      p.model!.setPosition(pos.x, pos.y, pos.z);
      p.model!.setEulerAngles(0, dir * 90, 0);
      p.animator!.update(dt, true);
    }
  }
  destroy() {
    for (const p of this.people) {
      p.model?.destroy();
      this.world.remove(p.entity);
    }
  }
}
