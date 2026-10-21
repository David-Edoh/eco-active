import {
  Application,
  BoundingBox,
  Entity,
  MeshInstance,
  RenderComponent,
  VertexBuffer,
  VertexFormat,
  Mat4,
  Vec3,
  Quat,
  BUFFER_DYNAMIC,
} from "playcanvas";
import type { World } from "miniplex";
import type { GameEntity } from "../ecs/components";
import type { District } from "../types";
import {
  createTrafficRoutes,
  advanceTraffic,
  trafficHeading,
  trafficAngleDelta,
  type TrafficPoint,
} from "./trafficRoutes";
import { AssetLibrary } from "../utils/assetLoader";
class TrafficBatch {
  private cars: {
    entity: GameEntity;
    route: TrafficPoint[];
    pending: number;
    displayX: number;
    displayZ: number;
    displayYaw: number;
  }[] = [];
  private template: Entity;
  private root = new Entity("Instanced traffic");
  private buffer: VertexBuffer;
  private data: Float32Array;
  private radius = 0;
  private height = 0;
  private meshes: MeshInstance[] = [];
  private matrix = new Mat4();
  private position = new Vec3();
  private rotation = new Quat();
  private scale = new Vec3(1, 1, 1);
  private elapsed = 0;
  private bounds = new BoundingBox();
  constructor(
    app: Application,
    library: AssetLibrary,
    private world: World<GameEntity>,
    routes: TrafficPoint[][],
    model: string,
    batch: number,
    count: number,
    private headingOffset: number,
  ) {
    this.data = new Float32Array(16 * count);
    this.root.name = `Instanced traffic ${model}`;
    this.template = library.instantiate(model);
    this.buffer = new VertexBuffer(
      app.graphicsDevice,
      VertexFormat.getDefaultInstancingFormat(app.graphicsDevice),
      count,
      { usage: BUFFER_DYNAMIC, data: this.data },
    );
    for (const r of this.template.findComponents("render") as RenderComponent[])
      for (const source of r.meshInstances) {
        const aabb = source.mesh!.aabb;
        this.radius = Math.max(
          this.radius,
          Math.hypot(
            Math.abs(aabb.center.x) + aabb.halfExtents.x,
            Math.abs(aabb.center.z) + aabb.halfExtents.z,
          ),
        );
        this.height = Math.max(this.height, aabb.center.y + aabb.halfExtents.y);
        const mi = new MeshInstance(source.mesh!, source.material!, this.root);
        mi.setInstancing(this.buffer, true);
        mi.castShadow = false;
        this.meshes.push(mi);
      }
    this.root.addComponent("render", {
      meshInstances: this.meshes,
      castShadows: false,
    });
    app.root.addChild(this.root);
    for (let i = 0; routes.length && i < count; i++) {
      let route = routes[(i + batch * 8) % routes.length];
      const navigation = {
        waypoint: Math.floor(
          route.length * (((i + batch * 8) * 0.61803398875) % 1),
        ),
        progress: 0,
        speed: 3 + (i % 3),
      };
      if (model === "bus" || model === "keke") {
        const anchors = [
          [-35, 15],
          [22, 32],
          [43, -28],
          [-83, -23],
        ];
        const anchor = anchors[i % anchors.length];
        let nearest = Infinity;
        for (const candidate of routes)
          candidate.forEach((point, index) => {
            const distance = Math.hypot(
              point[0] - anchor[0],
              point[1] - anchor[1],
            );
            if (distance < nearest) {
              nearest = distance;
              route = candidate;
              navigation.waypoint = index;
            }
          });
        if (model === "keke")
          navigation.waypoint = (navigation.waypoint + 5) % route.length;
        navigation.speed =
          model === "bus" ? 3.2 + (i % 2) * 0.4 : 2.6 + (i % 3) * 0.4;
      }
      const point = route[navigation.waypoint];
      const entity = world.add({
        id: `traffic-${batch}-${i}`,
        traffic: true,
        vehicle: true,
        vehicleModel: model,
        position: { x: point[0], y: 0.19, z: point[1] },
        navigation,
        yaw: trafficHeading(route, navigation.waypoint, 0),
      });
      this.cars.push({
        entity,
        route,
        pending: 0,
        displayX: point[0],
        displayZ: point[1],
        displayYaw: entity.yaw!,
      });
    }
  }

  update(dt: number, x: number, z: number) {
    this.elapsed += dt;
    const distantTick = this.elapsed > 0.2;
    const blend = -Math.expm1(-12 * dt);
    let visible = 0;
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (const car of this.cars) {
      const p = car.entity.position!;
      const distance = Math.hypot(p.x - x, p.z - z);
      const navigation = car.entity.navigation!;
      car.pending += dt;
      if (distance < 55 || distantTick) {
        if (distance > 4)
          advanceTraffic(car.route, navigation, car.pending * navigation.speed);
        car.pending = 0;
        const a = car.route[navigation.waypoint];
        const b = car.route[(navigation.waypoint + 1) % car.route.length];
        const dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = navigation.progress / Math.hypot(dx, dz);
        p.x = a[0] + dx * t;
        p.z = a[1] + dz * t;
        car.entity.yaw = trafficHeading(
          car.route,
          navigation.waypoint,
          navigation.progress,
        );
      }
      // Presentation only: ECS/navigation remain authoritative at their existing budgets.
      // Exponential easing is frame-rate independent and cannot overshoot a target.
      car.displayX += (p.x - car.displayX) * blend;
      car.displayZ += (p.z - car.displayZ) * blend;
      car.displayYaw +=
        trafficAngleDelta(car.displayYaw, car.entity.yaw!) * blend;
      car.displayYaw = trafficAngleDelta(0, car.displayYaw);
      if (distance < 100) {
        minX = Math.min(minX, car.displayX);
        minZ = Math.min(minZ, car.displayZ);
        maxX = Math.max(maxX, car.displayX);
        maxZ = Math.max(maxZ, car.displayZ);
        this.position.set(car.displayX, 0.19, car.displayZ);
        this.rotation.setFromEulerAngles(
          0,
          car.displayYaw + this.headingOffset,
          0,
        );
        this.matrix.setTRS(this.position, this.rotation, this.scale);
        this.data.set(this.matrix.data, visible++ * 16);
      }
    }
    if (distantTick) this.elapsed = 0;
    this.buffer.setData(this.data);
    if (visible) {
      this.bounds.center.set(
        (minX + maxX) / 2,
        0.19 + this.height / 2,
        (minZ + maxZ) / 2,
      );
      this.bounds.halfExtents.set(
        (maxX - minX) / 2 + this.radius,
        this.height / 2 + 0.05,
        (maxZ - minZ) / 2 + this.radius,
      );
    }
    for (const mi of this.meshes) {
      mi.instancingCount = visible;
      if (visible) mi.setCustomAabb(this.bounds);
    }
    this.root.enabled = visible > 0;
  }
  destroy() {
    this.root.destroy();
    this.template.destroy();
    this.buffer.destroy();
    for (const c of this.cars) this.world.remove(c.entity);
  }
}

// Each model has one shared mesh/material set and one bounded instance buffer.
export class TrafficSystem {
  private batches: TrafficBatch[];
  constructor(
    app: Application,
    library: AssetLibrary,
    world: World<GameEntity>,
    district: District,
  ) {
    const routes = createTrafficRoutes(district.roads);
    const busRoutes = createTrafficRoutes(
      district.roads.filter((road) => road.width >= 10),
    );
    const roster = [
      { model: "sedan", count: 6, offset: 180 },
      { model: "wagon", count: 6, offset: 0 },
      { model: "sports", count: 4, offset: 0 },
      { model: "bus", count: 4, offset: 0 },
      { model: "keke", count: 4, offset: 0 },
    ];
    this.batches = roster.map(
      (entry, index) =>
        new TrafficBatch(
          app,
          library,
          world,
          entry.model === "bus" ? busRoutes : routes,
          entry.model,
          index,
          entry.count,
          entry.offset,
        ),
    );
  }
  update(dt: number, x: number, z: number) {
    for (const batch of this.batches) batch.update(dt, x, z);
  }
  destroy() {
    for (const batch of this.batches) batch.destroy();
  }
}
