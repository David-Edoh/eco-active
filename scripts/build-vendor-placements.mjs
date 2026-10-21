// Photo-interpreted roadside commerce. Never changes OSM buildings or roads.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {
  inside,
  distance,
  corners,
  overlap,
} from "./worldPlacementGeometry.mjs";
const base = "public/assets/world";
const district = JSON.parse(await fs.readFile(`${base}/district.json`, "utf8"));
const catalog = JSON.parse(
  await fs.readFile(`${base}/vendor-catalog.json`, "utf8"),
).models;
const models = Object.keys(catalog);
const roadFootprints = district.roads.map((r) => {
  const [a, b] = r.points;
  return {
    x: (a[0] + b[0]) / 2,
    z: (a[1] + b[1]) / 2,
    w: Math.hypot(b[0] - a[0], b[1] - a[1]),
    d: r.width + 1.4,
    yaw: (-Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
  };
});
// Fronts face their road. Side is relative to the ordered road tangent.
// Dense commercial approach beside Trinity/Custom Street, and the eastern
// outside frontage; lighter frontage strip to the north; scattered park-edge sellers.
const zones = [
  {
    id: "church-custom",
    density: "dense",
    road: "Custom Street",
    select: (a, b) => a[0] > -85 && b[0] > -112,
    side: -1,
    spacing: 4.1,
    offsets: [1.6, 4.8],
    max: 18,
  },
  {
    id: "church-broad",
    density: "dense",
    road: "Broad Street",
    select: (a, b) => Math.abs(a[0] - 27.3) < 0.1 && b[1] < 0,
    side: 1,
    spacing: 4.8,
    offsets: [2, 5],
    max: 10,
  },
  {
    id: "east-frontage",
    density: "dense",
    road: "Broad Street",
    select: (a, b) => a[1] > 30 && a[0] < 80 && b[1] > 30,
    side: 1,
    spacing: 5,
    offsets: [2.2],
    max: 9,
  },
  {
    id: "junction-market",
    density: "dense",
    road: "Alli Street",
    select: (a, b) => a[1] > -85 && b[1] < -23,
    side: -1,
    spacing: 4.4,
    offsets: [1.8, 4.5],
    max: 9,
  },
  {
    id: "north-frontage",
    density: "dense",
    road: "Nnamdi Azikiwe Street",
    select: (a, b) => a[0] > 0 && b[0] > -50,
    side: 1,
    spacing: 4.2,
    offsets: [1.8],
    max: 10,
  },
  {
    id: "park-west",
    density: "sparse",
    road: "Broad Street",
    select: (a, b) => a[0] < -35 && a[0] > -100 && a[1] < 15 && b[0] > -120,
    side: 1,
    spacing: 18,
    offsets: [1.8],
    max: 4,
  },
  {
    id: "park-north",
    density: "sparse",
    road: "Broad Street",
    select: (a, b) => a[0] < -40 && a[1] < -35 && b[0] > -100,
    side: 1,
    spacing: 22,
    offsets: [1.6],
    max: 2,
  },
];
const stalls = [],
  audit = [];
for (const zone of zones) {
  let count = 0,
    index = 0;
  for (const road of district.roads.filter(
    (r) => r.name === zone.road && zone.select(...r.points),
  )) {
    const [a, b] = road.points,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      tx = dx / length,
      tz = dz / length,
      nx = -tz * zone.side,
      nz = tx * zone.side;
    for (
      let along = 2.6;
      along < length - 2.6 && count < zone.max;
      along += zone.spacing
    ) {
      const model =
        zone.density === "sparse"
          ? "vendor-pos-umbrella"
          : models[index++ % models.length];
      const [w, h, d] = catalog[model].size;
      for (const extra of zone.offsets) {
        const offset = road.width / 2 + d / 2 + extra;
        const item = {
          kind: "vendor",
          model,
          x: +(a[0] + tx * along + nx * offset).toFixed(3),
          y: 0.14,
          z: +(a[1] + tz * along + nz * offset).toFixed(3),
          yaw: +((Math.atan2(-nx, -nz) * 180) / Math.PI).toFixed(3),
          sx: 1,
          sy: 1,
          sz: 1,
          w,
          d,
          height: h,
          id: `vendor-${zone.id}-${count}`,
          name: zone.id,
        };
        const pts = [...corners(item, 0.55), [item.x, item.z]];
        if (
          pts.some(
            ([x, z]) =>
              inside(x, z, district.park) ||
              Math.abs(x) > 170 ||
              Math.abs(z) > 170 ||
              district.roads.some(
                (r) => distance(x, z, ...r.points) < r.width / 2 + 0.7,
              ),
          )
        )
          continue;
        if (roadFootprints.some((r) => overlap(item, r, 0.55))) continue;
        if (
          district.buildings.some((b) => overlap(item, b, 0.75)) ||
          stalls.some((b) => overlap(item, b, 1.15))
        )
          continue;
        if (
          Math.hypot(item.x - district.spawn[0], item.z - district.spawn[1]) <
          4.5
        )
          continue;
        stalls.push(item);
        count++;
        break;
      }
    }
  }
  audit.push({
    zone: zone.id,
    density: zone.density,
    spacing: zone.spacing,
    count,
  });
}
assert(stalls.length >= 20, "Too few roadside sellers");
assert(
  new Set(stalls.map((s) => s.model)).size === 6,
  "All six supplied stall models must be represented",
);
// Choose idle attendants with an accessible standing position beside the stall,
// retaining the existing total NPC count and near-player activation budget.
const attendants = [];
for (const stall of stalls) {
  if (attendants.length >= 6) break;
  if (stall.model === "vendor-pos-umbrella" && attendants.length % 2 === 0)
    continue;
  const yaw = (stall.yaw * Math.PI) / 180;
  for (const side of [-1, 1]) {
    const x = stall.x + Math.cos(yaw) * side * (stall.w / 2 + 0.85),
      z = stall.z - Math.sin(yaw) * side * (stall.w / 2 + 0.85);
    const point = { x, z, yaw: 0, w: 0.8, d: 0.8 };
    if (
      inside(x, z, district.park) ||
      district.roads.some(
        (r) => distance(x, z, ...r.points) < r.width / 2 + 0.55,
      ) ||
      district.buildings.some((b) => overlap(point, b)) ||
      stalls.some((b) => overlap(point, b, 0.1))
    )
      continue;
    attendants.push({
      stallId: stall.id,
      x: +x.toFixed(3),
      z: +z.toFixed(3),
      yaw: stall.yaw,
    });
    break;
  }
}
district.stalls = stalls;
district.vendorAttendants = attendants;
const chunks = new Map();
for (const c of district.chunks) {
  const originalItems = JSON.parse(await fs.readFile(`public${c.url}`, "utf8"));
  const items = originalItems.filter((item) => item.kind !== "vendor");
  chunks.set(c.id, {
    descriptor: c,
    items,
    changed: originalItems.length !== items.length,
  });
}
for (const stall of stalls) {
  const cx = Math.floor(stall.x / 64),
    cz = Math.floor(stall.z / 64),
    id = `${cx}_${cz}`;
  if (!chunks.has(id))
    chunks.set(id, {
      descriptor: {
        id,
        x: cx * 64 + 32,
        z: cz * 64 + 32,
        url: `/assets/world/chunk-${id}.json`,
      },
      items: [],
      changed: true,
    });
  chunks.get(id).items.push(stall);
  chunks.get(id).changed = true;
}
for (const { descriptor, items, changed } of chunks.values())
  if (changed)
    await fs.writeFile(`public${descriptor.url}`, JSON.stringify(items));
district.chunks = [...chunks.values()].map((c) => c.descriptor);
await fs.writeFile(`${base}/district.json`, JSON.stringify(district));
await fs.mkdir("docs/references/vendors", { recursive: true });
await fs.writeFile(
  "docs/references/vendors/placement-audit.json",
  JSON.stringify(
    {
      basis:
        "Two user-supplied photographs; dense market/church approaches and intermittent park-edge sellers. Individual locations and dimensions interpreted, not surveyed.",
      zones: audit,
      stalls,
      attendants,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { total: stalls.length, zones: audit, attendants: attendants.length },
    null,
    2,
  ),
);
