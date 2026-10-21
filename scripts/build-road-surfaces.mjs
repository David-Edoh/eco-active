// Offline map fitting of the supplied street surface/materials; no browser Three.js.
import fs from "node:fs/promises";
import ClipperLib from "clipper-lib";
import { ShapeUtils, Vector2 } from "three";
const directory = "public/assets/world";
const district = JSON.parse(
  await fs.readFile(`${directory}/district.json`, "utf8"),
);
const scale = 1000;
const point = ([x, z]) => ({
  X: Math.round(x * scale),
  Y: Math.round(z * scale),
});
function union(paths, operation = ClipperLib.ClipType.ctUnion, clips = []) {
  const c = new ClipperLib.Clipper();
  c.StrictlySimple = true;
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  if (clips.length) c.AddPaths(clips, ClipperLib.PolyType.ptClip, true);
  const result = new ClipperLib.PolyTree();
  c.Execute(
    operation,
    result,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return result;
}
function corridors(extra) {
  const paths = [];
  for (const road of district.roads) {
    const offset = new ClipperLib.ClipperOffset(2, 0.05 * scale),
      result = [];
    offset.AddPath(
      road.points.map(point),
      ClipperLib.JoinType.jtMiter,
      ClipperLib.EndType.etOpenButt,
    );
    offset.Execute(result, (road.width / 2 + extra) * scale);
    paths.push(...result);
  }
  // Bounded miter joins bridge bends and T mouths without overlapping pavement.
  const incident = new Map();
  for (const road of district.roads)
    for (let i = 0; i < 2; i++) {
      const key = road.nodeIds[i];
      if (!incident.has(key)) incident.set(key, []);
      incident.get(key).push({
        p: road.points[i],
        q: road.points[1 - i],
        w: road.width / 2 + extra,
      });
    }
  for (const arms of incident.values())
    if (arms.length > 1) {
      const points = [];
      for (const { p, q, w } of arms) {
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]),
          nx = -(q[1] - p[1]) / d,
          nz = (q[0] - p[0]) / d;
        points.push(
          [p[0] + nx * w, p[1] + nz * w],
          [p[0] - nx * w, p[1] - nz * w],
        );
      }
      // Convex hull of mouth edges closes arbitrary-angle joins, retaining road widths.
      points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (a, b, c) =>
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const half = (list) => {
        const h = [];
        for (const p of list) {
          while (h.length > 1 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop();
          h.push(p);
        }
        return h.slice(0, -1);
      };
      const hull = [...half(points), ...half([...points].reverse())].map(point);
      if (hull.length >= 3) {
        if (!ClipperLib.Clipper.Orientation(hull)) hull.reverse();
        paths.push(hull);
      }
    }
  return ClipperLib.Clipper.PolyTreeToPaths(union(paths));
}
const asphalt = corridors(0),
  outer = corridors(2);
const sidewalks = ClipperLib.Clipper.PolyTreeToPaths(
  union(outer, ClipperLib.ClipType.ctDifference, asphalt),
);
let triangles = 0;
for (let x = -4; x <= 3; x++)
  for (let z = -4; z <= 3; z++) {
    const id = `${x}_${z}`,
      file = `${directory}/chunk-${id}.json`;
    let items;
    try {
      items = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      items = [];
    }
    for (const [kind, paths, y] of [
      ["road", asphalt, 0.14],
      ["pavement", sidewalks, 0.16],
    ]) {
      const square = [
        [x * 64, z * 64],
        [(x + 1) * 64, z * 64],
        [(x + 1) * 64, (z + 1) * 64],
        [x * 64, (z + 1) * 64],
      ].map(point);
      const tree = union(paths, ClipperLib.ClipType.ctIntersection, [square]);
      const positions = [];
      function visit(node) {
        if (node.Contour().length && !node.IsHole()) {
          const contour = node
            .Contour()
            .map((p) => new Vector2(p.X / scale, p.Y / scale));
          const holes = node
            .Childs()
            .filter((n) => n.IsHole())
            .map((n) =>
              n.Contour().map((p) => new Vector2(p.X / scale, p.Y / scale)),
            );
          const faces = ShapeUtils.triangulateShape(contour, holes);
          const vertices = [...contour, ...holes.flat()];
          for (const face of faces) {
            const [a, b, c] = face.map((i) => vertices[i]);
            const signedArea =
              (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            if (Math.abs(signedArea) < 1e-8) continue;
            // X/Z plane requires clockwise winding for upward-facing triangles.
            const order =
              (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0
                ? [a, c, b]
                : [a, b, c];
            for (const p of order)
              positions.push(p.x - x * 64, y, p.y - z * 64);
            triangles++;
          }
        }
        node.Childs().forEach(visit);
      }
      visit(tree);
      if (positions.length)
        items.push({
          kind,
          model: "mapped-surface",
          x: x * 64,
          y: 0,
          z: z * 64,
          yaw: 0,
          sx: 1,
          sy: 1,
          sz: 1,
          positions,
        });
    }
    if (items.length) {
      await fs.writeFile(file, JSON.stringify(items));
      if (!district.chunks.some((c) => c.id === id))
        district.chunks.push({
          id,
          x: x * 64 + 32,
          z: z * 64 + 32,
          url: `/assets/world/chunk-${id}.json`,
        });
    }
  }
await fs.writeFile(`${directory}/district.json`, JSON.stringify(district));
console.log(
  `${triangles} road/pavement triangles, unioned before chunk clipping`,
);
