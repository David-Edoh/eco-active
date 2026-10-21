// node --import tsx scripts/test-vendors.mjs
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import ClipperLib from "clipper-lib";
import { PlayerMovement } from "../src/playcanvas/scripts/PlayerMovement.ts";
import { PedestrianSystem } from "../src/playcanvas/systems/PedestrianSystem.ts";
import { createGameWorld } from "../src/playcanvas/ecs/createGameWorld.ts";
const district = JSON.parse(
  await fs.readFile("public/assets/world/district.json", "utf8"),
);
const audit = JSON.parse(
  await fs.readFile("docs/references/vendors/placement-audit.json", "utf8"),
);
const catalog = JSON.parse(
  await fs.readFile("public/assets/world/vendor-catalog.json", "utf8"),
);
function polygon(b) {
  const a = (-b.yaw * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, z]) => ({
    X: Math.round((b.x + ((x * b.w) / 2) * c - ((z * b.d) / 2) * s) * 1000),
    Y: Math.round((b.z + ((x * b.w) / 2) * s + ((z * b.d) / 2) * c) * 1000),
  }));
}
function intersects(a, b) {
  const clip = new ClipperLib.Clipper();
  clip.AddPath(a, ClipperLib.PolyType.ptSubject, true);
  clip.AddPath(b, ClipperLib.PolyType.ptClip, true);
  const result = [];
  clip.Execute(
    ClipperLib.ClipType.ctIntersection,
    result,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return result.some((p) => Math.abs(ClipperLib.Clipper.Area(p)) > 1);
}
const roadPolygons = [];
for (const road of district.roads) {
  const offset = new ClipperLib.ClipperOffset();
  offset.AddPath(
    road.points.map((p) => ({
      X: Math.round(p[0] * 1000),
      Y: Math.round(p[1] * 1000),
    })),
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etOpenRound,
  );
  const result = [];
  offset.Execute(result, (road.width / 2 + 0.6) * 1000);
  roadPolygons.push(...result);
}
const park = district.park.map((p) => ({
  X: Math.round(p[0] * 1000),
  Y: Math.round(p[1] * 1000),
}));
const movement = new PlayerMovement(district),
  baseline = new PlayerMovement({ ...district, stalls: [] });
for (const stall of district.stalls) {
  const p = polygon(stall);
  assert(!intersects(p, park), `Park collision ${stall.id}`);
  assert(
    !roadPolygons.some((r) => intersects(p, r)),
    `Lane/clearance collision ${stall.id}`,
  );
  assert(
    !district.buildings.some((b) => intersects(p, polygon(b))),
    `Building collision ${stall.id}`,
  );
  assert(
    !movement.canMove(stall.x, stall.z),
    `Stall must block walking ${stall.id}`,
  );
  assert(
    baseline.canMove(stall.x, stall.z),
    "Original building collision must remain separate",
  );
  const [w, h, d] = catalog.models[stall.model].size;
  assert(
    Math.abs(w - stall.w) < 0.001 &&
      Math.abs(d - stall.d) < 0.001 &&
      Math.abs(h - stall.height) < 0.001,
  );
}
for (let i = 0; i < district.stalls.length; i++)
  for (let j = i + 1; j < district.stalls.length; j++)
    assert(
      !intersects(polygon(district.stalls[i]), polygon(district.stalls[j])),
      "No overlapping stalls",
    );
for (const road of district.roads)
  for (const p of road.points)
    if (baseline.canMove(...p))
      assert(movement.canMove(...p), "Stalls cannot obstruct road centres");
assert.equal(new Set(district.stalls.map((s) => s.model)).size, 6);
assert(
  audit.zones
    .filter((z) => z.density === "dense")
    .reduce((n, z) => n + z.count, 0) >
    audit.zones
      .filter((z) => z.density === "sparse")
      .reduce((n, z) => n + z.count, 0) *
      4,
);
const world = createGameWorld();
let destroyed = 0;
const assets = {
  instantiatePedestrian(variant) {
    assert(variant >= 0 && variant < 5);
    return {
      findComponents: () => [],
      setPosition() {},
      setEulerAngles() {},
      destroy() {
        destroyed++;
      },
    };
  },
  getAnimations: () => [],
  pedestrianModel: () => "",
};
const system = new PedestrianSystem(
  { root: { addChild() {} } },
  assets,
  world,
  movement,
  district,
);
const vendors = [...world].filter((e) => e.vendor);
assert.equal(vendors.length, 6);
assert.equal(world.size, 12);
const initial = vendors.map((e) => ({ ...e.position }));
for (const e of vendors) {
  assert(movement.canMove(e.position.x, e.position.z));
  system.update(0.2, e.position.x, e.position.z);
}
assert.deepEqual(
  vendors.map((e) => e.position),
  initial,
  "Idle sellers stay at their assigned stalls",
);
system.update(0.2, 1000, 1000);
assert(destroyed > 0, "Distance eviction destroys seller models");
system.destroy();
assert.equal(world.size, 0, "Teardown removes all NPCs");
console.log(
  `Passed: ${district.stalls.length} placements, six supplied models, lane/park/building clearance, collision, density, six idle NPCs and cleanup.`,
);
