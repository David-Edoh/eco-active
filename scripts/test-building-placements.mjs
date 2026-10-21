import assert from "node:assert/strict";
import fs from "node:fs/promises";
const district = JSON.parse(
  await fs.readFile("public/assets/world/district.json", "utf8"),
);
const catalog = JSON.parse(
  await fs.readFile("public/assets/world/building-catalog.json", "utf8"),
);
const audit = JSON.parse(
  await fs.readFile("docs/references/buildings/placement-audit.json", "utf8"),
);
const ids = new Set();
for (const b of district.buildings) {
  assert(!ids.has(b.id), `duplicate ${b.id}`);
  ids.add(b.id);
  const size = catalog.models[b.model].size;
  assert(
    [
      catalog.profiles[b.profile].model,
      ...Object.values(catalog.profiles[b.profile].levelModels || {}),
    ].includes(b.model),
  );
  assert(Math.abs(b.sx * size[0] - b.w) < 0.001);
  assert(Math.abs(b.sy * size[1] - b.height) < 0.001);
  assert(Math.abs(b.sz * size[2] - b.d) < 0.001);
  assert(b.heightSource && b.appearanceSource);
  const a = audit.find((a) => a.id === b.id),
    yaw = (b.yaw * Math.PI) / 180,
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  for (const p of a.footprint) {
    const dx = p[0] - b.x,
      dz = p[1] - b.z;
    assert(Math.abs(c * dx - s * dz) <= b.w / 2 + 0.005, `${b.id} footprint x`);
    assert(Math.abs(s * dx + c * dz) <= b.d / 2 + 0.005, `${b.id} footprint z`);
  }
}
const occurrences = new Map();
for (const chunk of district.chunks) {
  const items = JSON.parse(await fs.readFile(`public${chunk.url}`, "utf8"));
  for (const b of items.filter((i) => i.kind === "building")) {
    assert(!district.skyline.some((s) => s.id === b.id));
    assert.deepEqual(
      b,
      district.buildings.find((a) => a.id === b.id),
    );
    occurrences.set(b.id, (occurrences.get(b.id) || 0) + 1);
  }
}
for (const b of district.buildings)
  assert.equal(
    occurrences.get(b.id) || 0,
    district.skyline.some((s) => s.id === b.id) ? 0 : 1,
  );
assert.equal(district.buildings.find((b) => b.id === "544005150").height, 99.9);
assert.equal(
  district.buildings.find((b) => b.id === "705875899").model,
  "tinubu-trinity",
);
assert.equal(district.buildings.find((b) => b.id === "482032594").height, 124);
assert(new Set(district.buildings.map((b) => b.profile)).size >= 7);
for (const model of Object.keys(catalog.models))
  await fs.access(`public/assets/models/${model}.glb`);
console.log(
  `Passed ${ids.size} unique OSM placements: oriented footprint containment, scale, provenance, shared catalog, skyline ownership and local GLBs.`,
);
