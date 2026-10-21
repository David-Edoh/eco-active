import fs from "node:fs/promises";
import assert from "node:assert/strict";
import C from "clipper-lib";
const district = JSON.parse(
  await fs.readFile("public/assets/world/district.json", "utf8"),
);
const paths = { road: [], pavement: [] };
let triangles = 0;
for (const chunk of district.chunks) {
  const items = JSON.parse(await fs.readFile(`public${chunk.url}`, "utf8"));
  for (const item of items)
    if (item.positions) {
      const p = item.positions;
      for (let i = 0; i < p.length; i += 9) {
        const triangle = [0, 3, 6].map((j) => ({
          X: Math.round((p[i + j] + item.x) * 1000),
          Y: Math.round((p[i + j + 2] + item.z) * 1000),
        }));
        assert(
          triangle.every(
            (v) =>
              v.X >= Math.round((chunk.x - 32) * 1000) &&
              v.X <= Math.round((chunk.x + 32) * 1000) &&
              v.Y >= Math.round((chunk.z - 32) * 1000) &&
              v.Y <= Math.round((chunk.z + 32) * 1000),
          ),
        );
        assert(
          C.Clipper.Area(triangle) < 0,
          "Upward winding, non-degenerate triangles",
        );
        triangle.reverse();
        paths[item.kind].push(triangle);
        triangles++;
      }
    }
}
function combine(subject, clip = [], type = C.ClipType.ctUnion) {
  const c = new C.Clipper(),
    result = [];
  c.AddPaths(subject, C.PolyType.ptSubject, true);
  if (clip.length) c.AddPaths(clip, C.PolyType.ptClip, true);
  c.Execute(type, result, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return result;
}
const area = (paths) =>
  paths.reduce((sum, p) => sum + C.Clipper.Area(p), 0) / 1e6;
for (const kind of ["road", "pavement"])
  assert(
    Math.abs(area(paths[kind]) - area(combine(paths[kind]))) < 0.01,
    `${kind} triangles must not overlap`,
  );
assert(
  Math.abs(
    area(combine(paths.road, paths.pavement, C.ClipType.ctIntersection)),
  ) < 0.05,
  "No sidewalk across asphalt (0.05 m² aggregate millimetre-grid tolerance)",
);
for (const road of district.roads) {
  assert(road.id && road.nodeIds.length === 2, "OSM IDs retained");
  const [a, b] = road.points,
    p = {
      X: Math.round((a[0] + b[0]) * 500),
      Y: Math.round((a[1] + b[1]) * 500),
    };
  if (Math.abs(p.X) < 200000 && Math.abs(p.Y) < 200000)
    assert(
      paths.road.some((t) => C.Clipper.PointInPolygon(p, t) !== 0),
      "Mapped centerline covered",
    );
}
console.log(
  `Passed: ${triangles} triangles; chunk bounds, winding, non-overlap, clear junctions and mapped centerline coverage.`,
);
