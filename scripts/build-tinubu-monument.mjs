// Offline custom landmark geometry. No Three.js enters the browser bundle.
import fs from "node:fs/promises";
import * as T from "three";
import ClipperLib from "clipper-lib";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
};
const groups = new Map();
const materials = Object.fromEntries(
  Object.entries({
    tile: 0xe0e4df,
    coping: 0xf5f1e6,
    stone: 0x927450,
    mortar: 0x504a3b,
    bronze: 0x4e574e,
    feather: 0x626d60,
    water: 0x6a995d,
    jet: 0xc1e2da,
    iron: 0x164537,
    dark: 0x353f3c,
    paving: 0xb5afa1,
    relief: 0x9eaaa3,
  }).map(([name, color]) => [
    name,
    new T.MeshStandardMaterial({
      name: `tinubu-${name}`,
      color,
      roughness: name === "water" ? 0.28 : 0.85,
      metalness: name === "bronze" ? 0.35 : 0,
    }),
  ]),
);
function add(g, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const matrix = new T.Matrix4().compose(
    new T.Vector3(x, y, z),
    new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
    new T.Vector3(1, 1, 1),
  );
  g.applyMatrix4(matrix);
  const geom = g.index ? g.toNonIndexed() : g;
  geom.deleteAttribute("uv");
  const list = groups.get(mat) || [];
  list.push(geom);
  groups.set(mat, list);
}
const box = (w, h, d, m, x, y, z, ry = 0) =>
  add(new T.BoxGeometry(w, h, d), m, x, y, z, 0, ry);
const cylinder = (r, h, m, x, y, z, rt = r) =>
  add(new T.CylinderGeometry(rt, r, h, 64), m, x, y, z);
function tube(points, r, m) {
  add(
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      Math.max(8, points.length * 3),
      r,
      5,
      false,
    ),
    m,
  );
}
function ring(radius, width, y, m, cx = 0, cz = 0) {
  const g = new T.RingGeometry(radius - width, radius, 96);
  add(g, m, cx, y, cz, -Math.PI / 2);
}
// Aerial reference: one large pool and two small connected circular lobes.
// Union the footprints before building walls: no circular divider crosses water.
const poolCircles = [
  [0, 0, 10.3],
  [-13, -5.5, 3.1],
  [-19, -8, 3.2],
];
const poolPaths = poolCircles.map(([x, z, r]) =>
  Array.from({ length: 96 }, (_, i) => {
    const a = (i * Math.PI * 2) / 96;
    return {
      X: Math.round((x + r * Math.cos(a)) * 1000),
      Y: Math.round((z + r * Math.sin(a)) * 1000),
    };
  }),
);
for (let i = 1; i < poolCircles.length; i++) {
  const [ax, az] = poolCircles[i - 1],
    [bx, bz] = poolCircles[i];
  const length = Math.hypot(bx - ax, bz - az);
  const nx = (-(bz - az) / length) * 1.35,
    nz = ((bx - ax) / length) * 1.35;
  poolPaths.push(
    [
      [ax + nx, az + nz],
      [bx + nx, bz + nz],
      [bx - nx, bz - nz],
      [ax - nx, az - nz],
    ].map(([x, z]) => ({ X: Math.round(x * 1000), Y: Math.round(z * 1000) })),
  );
}
for (const path of poolPaths)
  if (!ClipperLib.Clipper.Orientation(path)) path.reverse();
const clipper = new ClipperLib.Clipper();
clipper.AddPaths(poolPaths, ClipperLib.PolyType.ptSubject, true);
const outline = [];
clipper.Execute(
  ClipperLib.ClipType.ctUnion,
  outline,
  ClipperLib.PolyFillType.pftNonZero,
  ClipperLib.PolyFillType.pftNonZero,
);
if (outline.length !== 1)
  throw Error("Fountain must be one connected footprint");
function offsetPool(distance) {
  const offset = new ClipperLib.ClipperOffset(2, 10),
    result = [];
  offset.AddPaths(
    outline,
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etClosedPolygon,
  );
  offset.Execute(result, distance * 1000);
  if (result.length !== 1) throw Error("Fountain offset must remain connected");
  return result[0];
}
const innerPool = offsetPool(-0.48);
function poolShape(outer, inner) {
  const shape = new T.Shape(
    outer.map((p) => new T.Vector2(p.X / 1000, -p.Y / 1000)),
  );
  if (inner)
    shape.holes.push(
      new T.Path(inner.map((p) => new T.Vector2(p.X / 1000, -p.Y / 1000))),
    );
  return shape;
}
// Plane XY maps to world XZ with upward normals. Extrusion becomes wall height.
add(
  new T.ExtrudeGeometry(poolShape(outline[0], innerPool), {
    depth: 0.48,
    bevelEnabled: false,
  }),
  "tile",
  0,
  0.24,
  0,
  -Math.PI / 2,
);
add(
  new T.ShapeGeometry(poolShape(innerPool)),
  "water",
  0,
  0.66,
  0,
  -Math.PI / 2,
);
add(
  new T.ShapeGeometry(poolShape(outline[0], innerPool)),
  "coping",
  0,
  0.725,
  0,
  -Math.PI / 2,
);
add(
  new T.ShapeGeometry(poolShape(offsetPool(1.35), outline[0])),
  "paving",
  0,
  0.22,
  0,
  -Math.PI / 2,
);
// Small circular nozzle rings make the two satellite pools legible from above.
for (const [x, z, r] of poolCircles.slice(1)) {
  const points = Array.from({ length: 65 }, (_, i) => {
    const a = (i * Math.PI * 2) / 64;
    return [x + Math.cos(a) * (r - 0.8), 0.73, z + Math.sin(a) * (r - 0.8)];
  });
  tube(points, 0.025, "dark");
}
const tiers = [
  [3.3, 0.4, 0.87],
  [2.98, 0.42, 1.28],
  [2.65, 1.35, 2.16],
  [1.48, 1.65, 3.66],
  [0.76, 1.25, 5.1],
];
// Deterministic individual polygonal veneer stones, inset against dark mortar.
let seed = 47;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (const [r, h, y] of tiers) {
  cylinder(r, h, "mortar", 0, y, 0);
  const rows = Math.max(1, Math.round(h / 0.32));
  for (let row = 0; row < rows; row++) {
    const count = Math.round((2 * Math.PI * r) / 0.42);
    for (let i = 0; i < count; i++) {
      const angle = ((i + (row % 2) * 0.5) * 2 * Math.PI) / count;
      const s = new T.Shape();
      const w = ((2 * Math.PI * r) / count) * 0.93,
        hh = (h / rows) * 0.91;
      s.moveTo(-w * 0.5, -hh * 0.22);
      s.lineTo(-w * 0.26, -hh * 0.5);
      s.lineTo(w * 0.34, -hh * 0.45);
      s.lineTo(w * 0.5, hh * 0.12);
      s.lineTo(w * 0.23, hh * 0.5);
      s.lineTo(-w * 0.39, hh * 0.4);
      s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false });
      const c = new T.Color().setHSL(
        0.09 + random() * 0.04,
        0.15 + random() * 0.16,
        0.35 + random() * 0.22,
      );
      const colors = [];
      for (let v = 0; v < g.attributes.position.count; v++)
        colors.push(c.r, c.g, c.b);
      g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      add(
        g,
        "stone",
        (r + 0.015) * Math.sin(angle),
        y - h / 2 + ((row + 0.5) * h) / rows,
        (r + 0.015) * Math.cos(angle),
        0,
        angle,
      );
    }
  }
  ring(r + 0.04, 0.12, y + h / 2 + 0.02, "coping");
}
materials.stone.color.setHex(0xffffff);
materials.stone.vertexColors = true;
// Three separate birds, asymmetric rising wings and individually scalloped feathers.
function bird(y, yaw, scale, raise) {
  const transform = new T.Matrix4()
    .makeRotationY(yaw)
    .scale(new T.Vector3(scale, scale, scale));
  transform.setPosition(0, y, 0);
  function part(g, m, x, y, z, rx = 0, ry = 0, rz = 0) {
    g.applyMatrix4(
      new T.Matrix4().compose(
        new T.Vector3(x, y, z),
        new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
        new T.Vector3(1, 1, 1),
      ),
    );
    g.applyMatrix4(transform);
    add(g, m);
  }
  const body = new T.SphereGeometry(1, 16, 10);
  body.scale(0.39, 0.4, 1.15);
  part(body, "bronze", 0, 0, 0);
  const head = new T.SphereGeometry(0.28, 12, 8);
  part(head, "bronze", 0, 0.48, -0.97);
  part(
    new T.ConeGeometry(0.12, 0.45, 8),
    "bronze",
    0,
    0.46,
    -1.35,
    -Math.PI / 2,
  );
  for (const side of [-1, 1]) {
    const wing = new T.Shape();
    wing.moveTo(0.15, 0);
    wing.bezierCurveTo(0.9, 0.45, 1.7, raise, 2.75, raise + 0.45);
    wing.bezierCurveTo(2.6, raise - 0.65, 1.5, -0.4, 0.25, -0.35);
    wing.closePath();
    const g = new T.ExtrudeGeometry(wing, {
      depth: 0.11,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.03,
      bevelSegments: 1,
      curveSegments: 8,
    });
    g.scale(side, 1, 1);
    part(g, "bronze", 0, 0, 0, 0, side * 0.17);
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const feather = new T.SphereGeometry(1, 8, 6);
      feather.scale(0.13, 0.54 + t * 0.15, 0.065);
      part(
        feather,
        "feather",
        side * (0.65 + t * 1.95),
        0.12 + t * raise,
        -0.03 + t * 0.22,
        0,
        0,
        -side * (0.45 + t * 0.4),
      );
    }
  }
  for (let i = -2; i <= 2; i++) {
    const tail = new T.SphereGeometry(1, 8, 6);
    tail.scale(0.12, 0.08, 0.6);
    part(tail, "feather", i * 0.15, -0.12, 1.1, 0, i * 0.18);
  }
}
bird(3.35, 0.3, 1.0, 1.45);
bird(4.65, 2.65, 0.86, 0.7);
bird(5.8, -0.9, 0.88, 2.25);
// Opposing tapered portals, with inward cantilever and geometric carved inlays.
for (const side of [-1, 1]) {
  const x = side * 5.5,
    z = side * 0.8;
  const s = new T.Shape();
  s.moveTo(-0.55, 0);
  s.lineTo(0.65, 0);
  s.lineTo(0.3, 4.7);
  s.lineTo(-0.35, 4.5);
  s.closePath();
  add(
    new T.ExtrudeGeometry(s, {
      depth: 0.65,
      bevelEnabled: true,
      bevelSize: 0.08,
      bevelThickness: 0.04,
      bevelSegments: 1,
    }),
    "tile",
    x,
    0.65,
    z,
  );
  box(2.45, 0.48, 0.78, "coping", x - side * 0.85, 5.08, z + 0.32, side * 0.03);
  for (let j = 0; j < 10; j++) {
    const yy = 1 + j * 0.38;
    tube(
      [
        [x - 0.24, yy, z + 0.72],
        [x + 0.2, yy + 0.19, z + 0.72],
        [x - 0.17, yy + 0.36, z + 0.72],
      ],
      0.018,
      "relief",
    );
  }
  // Opaque pale thin tubes suggest falling water without expensive transparent overdraw.
  for (let j = 0; j < 8; j++)
    tube(
      [
        [x - side * (0.35 + j * 0.18), 4.85, z + 0.25],
        [x - side * (0.38 + j * 0.18), 2.6, z + 0.3],
        [x - side * (0.4 + j * 0.18), 0.7, z + 0.4],
      ],
      0.014,
      "jet",
    );
}
// Two rings of inward arcing jets with visible bronze nozzles and supply pipes.
for (const [radius, count, height, reach] of [
  [7.8, 36, 1.45, 2.0],
  [5.7, 28, 1.9, 1.65],
]) {
  const pipe = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i * 2 * Math.PI) / 96;
    pipe.push([Math.cos(a) * radius, 0.73, Math.sin(a) * radius]);
  }
  tube(pipe, 0.035, "dark");
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count,
      c = Math.cos(a),
      s = Math.sin(a),
      p = [];
    cylinder(0.065, 0.18, "bronze", radius * c, 0.78, radius * s);
    for (let j = 0; j <= 12; j++) {
      const t = j / 12,
        r = radius - reach * t;
      p.push([r * c, 0.83 + 4 * height * t * (1 - t) - 0.15 * t, r * s]);
    }
    tube(p, 0.019, "jet");
  }
}
// Freestanding, actually extruded lettering; no opaque rectangular sign face.
const font = new FontLoader().parse(
  JSON.parse(
    await fs.readFile("src/assets/fonts/helvetiker_bold.typeface.json", "utf8"),
  ),
);
const letters = new TextGeometry("TINUBU SQUARE", {
  font,
  size: 1,
  depth: 0.17,
  curveSegments: 3,
  bevelEnabled: true,
  bevelThickness: 0.015,
  bevelSize: 0.012,
  bevelSegments: 1,
});
letters.computeBoundingBox();
const width = letters.boundingBox.max.x;
add(letters, "coping", -width / 2, 1.02, 10.48);
box(width + 0.5, 0.16, 0.65, "dark", 0, 0.92, 10.55);
for (const x of [-width * 0.37, width * 0.37])
  box(0.1, 0.9, 0.12, "dark", x, 0.48, 10.55);
// Tile joints follow the complete connected perimeter, including the necks.
for (let i = 0; i < outline[0].length; i += 3) {
  const a = outline[0][i],
    b = innerPool.reduce(
      (best, p) =>
        Math.hypot(p.X - a.X, p.Y - a.Y) <
        Math.hypot(best.X - a.X, best.Y - a.Y)
          ? p
          : best,
      innerPool[0],
    );
  tube(
    [
      [a.X / 1000, 0.73, a.Y / 1000],
      [b.X / 1000, 0.73, b.Y / 1000],
    ],
    0.008,
    "relief",
  );
}
const root = new T.Group();
root.name = "Tinubu photo reconstruction";
for (const [name, geometries] of groups) {
  // Some stone vertices carry color. All other parts in that group are colored above.
  const geometry = mergeGeometries(geometries);
  if (!geometry) throw Error(`Could not merge ${name}`);
  const mesh = new T.Mesh(geometry, materials[name]);
  mesh.name = `Tinubu ${name}`;
  root.add(mesh);
}
const glb = await new GLTFExporter().parseAsync(root, { binary: true });
await fs.writeFile(
  "public/assets/models/tinubu-monument.glb",
  Buffer.from(glb),
);
console.log(
  `Tinubu monument: ${root.children.length} material meshes, ${glb.byteLength} bytes`,
);
