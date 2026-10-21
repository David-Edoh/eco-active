// node --import tsx scripts/test-transport.mjs
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import ClipperLib from "clipper-lib";
import { PlayerMovement } from "../src/playcanvas/scripts/PlayerMovement.ts";
const d = JSON.parse(
  await fs.readFile("public/assets/world/district.json", "utf8"),
);
const audit = JSON.parse(
  await fs.readFile("docs/references/transport/parking-audit.json", "utf8"),
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
  const out = [];
  clip.Execute(
    ClipperLib.ClipType.ctIntersection,
    out,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return out.some((p) => Math.abs(ClipperLib.Clipper.Area(p)) > 1);
}
const roads = [];
for (const r of d.roads) {
  const offset = new ClipperLib.ClipperOffset();
  offset.AddPath(
    r.points.map((p) => ({
      X: Math.round(p[0] * 1000),
      Y: Math.round(p[1] * 1000),
    })),
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etOpenRound,
  );
  const out = [];
  offset.Execute(out, (r.width / 2 + 0.7) * 1000);
  roads.push(...out);
}
const park = d.park.map((p) => ({
  X: Math.round(p[0] * 1000),
  Y: Math.round(p[1] * 1000),
}));
const movement = new PlayerMovement(d),
  baseline = new PlayerMovement({ ...d, parkedVehicles: [] });
assert.equal(d.parkedVehicles.filter((p) => p.model === "bus").length, 4);
assert.equal(d.parkedVehicles.filter((p) => p.model === "keke").length, 8);
for (const item of d.parkedVehicles) {
  const p = polygon(item);
  assert(!roads.some((r) => intersects(p, r)), `Road obstruction ${item.id}`);
  assert(!intersects(p, park));
  assert(
    ![...d.buildings, ...d.stalls].some((b) => intersects(p, polygon(b))),
    `Shop/building overlap ${item.id}`,
  );
  assert(baseline.canMove(item.x, item.z));
  assert(
    !movement.canMove(item.x, item.z),
    "Parked bodies block player movement",
  );
  const chunkId = `${Math.floor(item.x / 64)}_${Math.floor(item.z / 64)}`;
  const chunk = JSON.parse(
    await fs.readFile(`public/assets/world/chunk-${chunkId}.json`, "utf8"),
  );
  assert.equal(chunk.filter((c) => c.id === item.id).length, 1);
}
for (let i = 0; i < d.parkedVehicles.length; i++)
  for (let j = i + 1; j < d.parkedVehicles.length; j++)
    assert(
      !intersects(polygon(d.parkedVehicles[i]), polygon(d.parkedVehicles[j])),
    );
for (const point of d.vendorAttendants)
  assert(
    movement.canMove(point.x, point.z),
    "Shop attendants retain clear standing space",
  );
assert(
  audit.groups.every((g) => g.count >= 3),
  "Parked vehicles form clusters, not isolated scatter",
);
for (const r of d.roads)
  for (const p of r.points)
    if (baseline.canMove(...p))
      assert(movement.canMove(...p), "Road access remains clear");
console.log(
  "Passed: 12 parked vehicles in three clusters, map/chunk consistency, independent road/park/shop clearance, collisions and attendant access.",
);
