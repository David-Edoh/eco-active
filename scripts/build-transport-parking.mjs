// Authored clustered motor-park pockets, using the supplied bus and keke meshes.
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
const models = JSON.parse(
  await fs.readFile(`${base}/transport-catalog.json`, "utf8"),
).models;
const roadBounds = district.roads.map((r) => {
  const [a, b] = r.points;
  return {
    x: (a[0] + b[0]) / 2,
    z: (a[1] + b[1]) / 2,
    w: Math.hypot(b[0] - a[0], b[1] - a[1]),
    d: r.width + 1.6,
    yaw: (-Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
  };
});
const parked = [];
function clear(item) {
  const points = [...corners(item, 0.5), [item.x, item.z]];
  if (
    points.some(
      ([x, z]) =>
        inside(x, z, district.park) ||
        Math.abs(x) > 170 ||
        Math.abs(z) > 170 ||
        district.roads.some(
          (r) => distance(x, z, ...r.points) < r.width / 2 + 0.8,
        ),
    )
  )
    return false;
  if (roadBounds.some((r) => overlap(item, r, 0.5))) return false;
  if (district.buildings.some((b) => overlap(item, b, 1))) return false;
  if ((district.stalls ?? []).some((b) => overlap(item, b, 1.8))) return false;
  if (
    (district.vendorAttendants ?? []).some((a) =>
      overlap(item, { ...a, w: 0.9, d: 0.9 }, 1.1),
    )
  )
    return false;
  if (parked.some((b) => overlap(item, b, 0.65))) return false;
  return Math.hypot(item.x - district.spawn[0], item.z - district.spawn[1]) > 5;
}
// Search for coherent rows, not individually random scatter. Every accepted row
// keeps its tangent, spacing and uniform heading; unsafe slots are omitted.
const groups = [
  {
    id: "custom-bus-rank",
    model: "bus",
    origin: [-45, 47],
    yaw: -160,
    slots: 5,
    rows: 1,
    step: 3.5,
  },
  {
    id: "custom-keke-rank",
    model: "keke",
    origin: [-45, 53],
    yaw: -160,
    slots: 6,
    rows: 1,
    step: 2.3,
  },
  {
    id: "alli-keke-rank",
    model: "keke",
    origin: [60, -55],
    yaw: -75,
    slots: 6,
    rows: 2,
    step: 2.2,
  },
  {
    id: "broad-bus-rank",
    model: "bus",
    origin: [42, 58],
    yaw: -65,
    slots: 4,
    rows: 1,
    step: 3.5,
  },
];
const audit = [];
for (const group of groups) {
  const [w, h, d] = models[group.model].size;
  let best = [];
  // Shift whole ranks only to find a usable forecourt around existing geography.
  for (const shiftZ of [0, 3, -3, 6, -6, 9])
    for (const shiftX of [0, 3, -3, 6, -6]) {
      const row = [];
      const a = (group.yaw * Math.PI) / 180;
      for (let j = 0; j < group.rows; j++)
        for (let i = 0; i < group.slots; i++) {
          const along = (i - (group.slots - 1) / 2) * group.step,
            back = j * (d + 1.4);
          const item = {
            kind: "parkedVehicle",
            model: group.model,
            x: +(
              group.origin[0] +
              shiftX +
              Math.cos(a) * along +
              Math.sin(a) * back
            ).toFixed(3),
            y: 0.16,
            z: +(
              group.origin[1] +
              shiftZ -
              Math.sin(a) * along +
              Math.cos(a) * back
            ).toFixed(3),
            yaw: group.yaw,
            sx: 1,
            sy: 1,
            sz: 1,
            w,
            d,
            height: h,
            id: `parked-${group.id}-${j}-${i}`,
            name: group.id,
          };
          if (clear(item) && !row.some((b) => overlap(item, b, 0.65)))
            row.push(item);
        }
      if (row.length > best.length) best = row;
    }
  if (best.length >= 3) {
    parked.push(...best);
    audit.push({
      id: group.id,
      model: group.model,
      count: best.length,
      heading: group.yaw,
    });
  }
}
assert(
  parked.filter((p) => p.model === "bus").length >= 3,
  "A grouped bus rank must fit",
);
assert(
  parked.filter((p) => p.model === "keke").length >= 6,
  "Grouped keke ranks must fit",
);
district.parkedVehicles = parked;
const chunks = new Map();
for (const c of district.chunks) {
  const original = JSON.parse(await fs.readFile(`public${c.url}`, "utf8"));
  const items = original.filter((item) => item.kind !== "parkedVehicle");
  chunks.set(c.id, {
    descriptor: c,
    items,
    changed: original.length !== items.length,
  });
}
for (const item of parked) {
  const cx = Math.floor(item.x / 64),
    cz = Math.floor(item.z / 64),
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
  chunks.get(id).items.push(item);
  chunks.get(id).changed = true;
}
for (const { descriptor, items, changed } of chunks.values())
  if (changed)
    await fs.writeFile(`public${descriptor.url}`, JSON.stringify(items));
district.chunks = [...chunks.values()].map((c) => c.descriptor);
await fs.writeFile(`${base}/district.json`, JSON.stringify(district));
await fs.mkdir("docs/references/transport", { recursive: true });
await fs.writeFile(
  "docs/references/transport/parking-audit.json",
  JSON.stringify(
    {
      basis:
        "Authored Nigerian-style grouped motor-park pockets near the commercial approaches; not surveyed parking locations. Stalls, walking clearances, road corridors and mapped buildings retained.",
      groups: audit,
      parked,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ total: parked.length, groups: audit }, null, 2));
