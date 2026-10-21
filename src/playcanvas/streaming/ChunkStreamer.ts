import {
  Application,
  Entity,
  MeshInstance,
  Mesh,
  Mat4,
  Vec3,
  Quat,
  VertexBuffer,
  VertexFormat,
  BUFFER_STATIC,
  BoundingBox,
  RenderComponent,
} from "playcanvas";
import type { World } from "miniplex";
import type { GameEntity } from "../ecs/components";
import type { District, WorldItem } from "../types";
import { AssetLibrary } from "../utils/assetLoader";
import { DISTRICT_VIEW_DISTANCE } from "../world/viewSettings";

interface Chunk {
  root: Entity;
  buffers: VertexBuffer[];
  meshes: Mesh[];
  entities: GameEntity[];
}
export class ChunkStreamer {
  private loaded = new Map<string, Chunk>();
  private pending = new Map<string, AbortController>();
  private templates = new Map<string, Entity>();
  private disposed = false;
  private skyline?: Chunk;
  private distant = new Map<string, Chunk>();
  private distantItems = new Map<string, WorldItem[]>();
  private elapsed = 1;
  private x = 0;
  private z = 0;
  radius = 110;
  constructor(
    private app: Application,
    private library: AssetLibrary,
    readonly district: District,
    private world: World<GameEntity>,
  ) {
    for (const item of district.distant ?? []) {
      const id = `${Math.floor(item.x / 64)}_${Math.floor(item.z / 64)}`;
      const items = this.distantItems.get(id) ?? [];
      items.push(item);
      this.distantItems.set(id, items);
    }
    if (district.skyline?.length)
      this.skyline = this.build("skyline", district.skyline);
  }
  get count() {
    return this.loaded.size;
  }
  get ids() {
    return [...this.loaded.keys()];
  }
  private build(id: string, items: WorldItem[], distant = false): Chunk {
    const root = new Entity(`chunk-${id}`);
    const buffers: VertexBuffer[] = [];
    const meshes: Mesh[] = [];
    const entities: GameEntity[] = [];
    const parked = new Map<WorldItem, GameEntity>();
    const groups = new Map<string, WorldItem[]>();
    for (const item of items) {
      if (item.kind === "parkedVehicle") {
        const entity = this.world.add({
          id: item.id!,
          vehicle: true,
          parked: true,
          vehicleModel: item.model,
          chunkId: id,
          position: { x: item.x, y: item.y, z: item.z },
          yaw: item.yaw,
        });
        entities.push(entity);
        parked.set(item, entity);
      }
      // The sealed session ground replaces the tapered curb tiles.
      if (item.kind === "ground" && !item.positions) continue;
      if (item.positions) {
        const entity = new Entity(`mapped-${item.kind}`);
        entity.setLocalPosition(item.x, 0, item.z);
        const mesh = new Mesh(this.app.graphicsDevice);
        mesh.setPositions(item.positions);
        const uvs = new Float32Array((item.positions.length / 3) * 2);
        for (let i = 0; i < item.positions.length / 3; i++) {
          uvs[i * 2] = item.positions[i * 3] + item.x;
          uvs[i * 2 + 1] = item.positions[i * 3 + 2] + item.z;
        }
        mesh.setUvs(0, uvs);
        const normals = new Float32Array(item.positions.length);
        for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
        mesh.setNormals(normals);
        mesh.update();
        meshes.push(mesh);
        entity.addComponent("render", {
          meshInstances: [
            new MeshInstance(
              mesh,
              this.library.materials.get(item.kind)!,
              entity,
            ),
          ],
          castShadows: false,
        });
        root.addChild(entity);
        continue;
      }
      const key = `${item.model}:${item.kind}:${item.profile ?? "base"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    for (const [key, instances] of groups) {
      const item = instances[0];
      let template = this.templates.get(item.model);
      if (!template) {
        template = this.library.instantiate(item.model);
        this.templates.set(item.model, template);
      }
      const data = new Float32Array(instances.length * 16);
      const mat = new Mat4();
      const q = new Quat();
      for (let i = 0; i < instances.length; i++) {
        const t = instances[i];
        const entity = parked.get(t);
        const position = entity?.position ?? t;
        q.setFromEulerAngles(0, entity?.yaw ?? t.yaw, 0);
        mat.setTRS(
          new Vec3(position.x, position.y, position.z),
          q,
          new Vec3(t.sx, t.sy, t.sz),
        );
        data.set(mat.data, i * 16);
      }
      const vb = new VertexBuffer(
        this.app.graphicsDevice,
        VertexFormat.getDefaultInstancingFormat(this.app.graphicsDevice),
        instances.length,
        { usage: BUFFER_STATIC, data },
      );
      buffers.push(vb);
      const entity = new Entity(key);
      root.addChild(entity);
      const meshInstances: MeshInstance[] = [];
      const instanceBounds: BoundingBox[] = [];
      for (const render of template.findComponents(
        "render",
      ) as RenderComponent[])
        for (const source of render.meshInstances) {
          const material =
            item.kind === "building"
              ? this.library.buildingMaterial(
                  source.material as import("playcanvas").StandardMaterial,
                  item.profile,
                )
              : item.kind === "vegetation" ||
                  item.kind === "vendor" ||
                  item.kind === "parkedVehicle"
                ? source.material
                : this.library.materials.get(item.kind)!;
          const mesh = new MeshInstance(source.mesh!, material!, entity);
          mesh.setInstancing(vb, false);
          mesh.cull = true;
          const bounds = new BoundingBox();
          const transformed = new BoundingBox();
          for (let i = 0; i < instances.length; i++) {
            mat.data.set(data.subarray(i * 16, i * 16 + 16));
            transformed.setFromTransformedAabb(source.mesh!.aabb, mat);
            if (i === 0) bounds.copy(transformed);
            else bounds.add(transformed);
          }
          instanceBounds.push(bounds);
          mesh.castShadow = !distant && item.kind === "building";
          mesh.receiveShadow = true;
          meshInstances.push(mesh);
        }
      entity.addComponent("render", {
        meshInstances,
        castShadows: !distant && item.kind === "building",
        receiveShadows: true,
      });
      // RenderComponent assigns its own (null) customAabb to incoming instances.
      // Apply per-mesh instance bounds afterwards so frustum culling uses them.
      meshInstances.forEach((mesh, index) =>
        mesh.setCustomAabb(instanceBounds[index]),
      );
    }
    this.app.root.addChild(root);
    return { root, buffers, meshes, entities };
  }
  async warm(x: number, z: number) {
    this.x = x;
    this.z = z;
    const nearest = [...this.district.chunks]
      .filter((c) => Math.hypot(c.x - x, c.z - z) < this.radius + 20)
      .sort(
        (a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
      );
    // Keep the same two-request cap during initial loading and later movement.
    for (let i = 0; i < nearest.length; i += 2)
      await Promise.all(nearest.slice(i, i + 2).map((c) => this.load(c)));
    // Prepare the bounded visible backdrop once before exposing the game.
    // Geometry/materials are shared; subsequent movement builds at most two cells.
    this.updateDistant(this.distantItems.size);
  }
  private release(chunk: Chunk) {
    chunk.root.destroy();
    chunk.buffers.forEach((buffer) => buffer.destroy());
    chunk.meshes.forEach((mesh) => mesh.destroy());
    chunk.entities.forEach((entity) => this.world.remove(entity));
  }
  private updateDistant(limit = 2) {
    const range = DISTRICT_VIEW_DISTANCE + 46; // Include cell bounds at the far clip.
    const candidates = [...this.distantItems.keys()]
      .map((id) => {
        const [cx, cz] = id.split("_").map(Number);
        return {
          id,
          distance: Math.hypot(cx * 64 + 32 - this.x, cz * 64 + 32 - this.z),
        };
      })
      .sort((a, b) => a.distance - b.distance);
    let built = 0;
    let incomplete = false;
    for (const { id, distance } of candidates) {
      let chunk = this.distant.get(id);
      if (distance > range + 64) {
        if (chunk) {
          this.release(chunk);
          this.distant.delete(id);
        }
        continue;
      }
      // Exact mapped detailed chunk wins. Missing/loading/evicted chunks retain
      // their lightweight building silhouettes, including on performance quality.
      if (!chunk && distance < range && !this.loaded.has(id) && built < limit) {
        chunk = this.build(`distant-${id}`, this.distantItems.get(id)!, true);
        this.distant.set(id, chunk);
        built++;
      }
      if (chunk) chunk.root.enabled = !this.loaded.has(id);
      else if (distance < range && !this.loaded.has(id)) incomplete = true;
    }
    return incomplete;
  }
  private async load(c: District["chunks"][number]) {
    if (this.pending.has(c.id) || this.loaded.has(c.id) || this.disposed)
      return;
    const controller = new AbortController();
    this.pending.set(c.id, controller);
    try {
      const response = await fetch(c.url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Chunk HTTP ${response.status}`);
      const items = (await response.json()) as WorldItem[];
      if (
        !this.disposed &&
        Math.hypot(c.x - this.x, c.z - this.z) < this.radius + 80
      ) {
        this.loaded.set(c.id, this.build(c.id, items));
        const distant = this.distant.get(c.id);
        if (distant) distant.root.enabled = false;
      }
    } catch (e) {
      if (!controller.signal.aborted)
        console.warn("Chunk load failed", c.id, e);
    } finally {
      this.pending.delete(c.id);
    }
  }
  update(dt: number, x: number, z: number) {
    this.x = x;
    this.z = z;
    this.elapsed += dt;
    if (this.elapsed < 0.15) return;
    this.elapsed = 0;
    for (const c of this.district.chunks)
      if (Math.hypot(c.x - x, c.z - z) > this.radius + 60) {
        const chunk = this.loaded.get(c.id);
        if (chunk) {
          this.release(chunk);
          this.loaded.delete(c.id);
          const distant = this.distant.get(c.id);
          if (distant) distant.root.enabled = true;
        }
        this.pending.get(c.id)?.abort();
      }
    const queue = this.district.chunks
      .filter(
        (c) =>
          Math.hypot(c.x - x, c.z - z) < this.radius &&
          !this.loaded.has(c.id) &&
          !this.pending.has(c.id),
      )
      .sort(
        (a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
      );
    this.updateDistant();
    for (const c of queue.slice(0, Math.max(0, 2 - this.pending.size)))
      void this.load(c);
  }
  destroy() {
    this.disposed = true;
    this.pending.forEach((c) => c.abort());
    for (const c of this.loaded.values()) {
      this.release(c);
    }
    this.loaded.clear();
    this.distant.forEach((chunk) => this.release(chunk));
    this.distant.clear();
    this.distantItems.clear();
    if (this.skyline) this.release(this.skyline);
    this.templates.forEach((t) => t.destroy());
  }
}
