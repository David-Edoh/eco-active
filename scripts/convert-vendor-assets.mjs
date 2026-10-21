// Offline conversion: node scripts/convert-vendor-assets.mjs /path/to/hide-and-seek
// Add --vehicles to convert bus.fbx and keke.fbx through the same static asset pipeline.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import {
  TextureLoader,
  Texture,
  Group,
  Mesh,
  MeshStandardMaterial,
  Box3,
  Vector3,
  Float32BufferAttribute,
  Ray,
  DoubleSide,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
const project = process.argv[2];
if (!project) throw Error("Supply Hide and Seek project directory");
const source = path.join(project, "Assets/Models");
TextureLoader.prototype.load = function () {
  return new Texture();
};
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const guidPaths = new Map();
async function index(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await index(file);
    else if (file.endsWith(".meta")) {
      const text = await fs.readFile(file, "utf8");
      const guid = text.match(/^guid: (\w+)/m)?.[1];
      if (guid) guidPaths.set(guid, file.slice(0, -5));
    }
  }
}
await index(source);
const vehicles = process.argv.includes("--vehicles");
const defs = vehicles
  ? [
      ["bus", 2.1],
      ["keke", 1.85],
    ]
  : [
      ["pos_umbrella", 2.8],
      ["shop_1", 2.6],
      ["shop_2", 2.8],
      ["shop_3", 2.7],
      ["shop_4", 2.55],
      ["food_vendor", 2.5],
    ];
const catalog = {
  source: "User-supplied Hide and Seek Unity project",
  models: {},
};
for (const [id, height] of defs) {
  const file = path.join(source, `${id}.fbx`);
  const bytes = await fs.readFile(file);
  const root = new FBXLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root),
    centre = bounds.getCenter(new Vector3()),
    scale = height / bounds.getSize(new Vector3()).y;
  const parts = [];
  root.traverse((n) => {
    if (!n.isMesh) return;
    let g = n.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(n.matrixWorld);
    g.translate(-centre.x, -bounds.min.y, -centre.z);
    g.scale(scale, scale, scale);
    for (const key of Object.keys(g.attributes))
      if (!["position", "normal", "uv"].includes(key)) g.deleteAttribute(key);
    g.clearGroups();
    parts.push(g);
  });
  const geometry = mergeVertices(mergeGeometries(parts));
  // A small local AO bake supplements the original albedo; no runtime AO pass.
  const bvh = new MeshBVH(geometry);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const point = new Vector3(),
    normal = new Vector3(),
    direction = new Vector3(),
    ray = new Ray();
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    point.fromBufferAttribute(geometry.attributes.position, i);
    normal.fromBufferAttribute(geometry.attributes.normal, i).normalize();
    ray.origin.copy(point).addScaledVector(normal, 0.012);
    let occluded = 0;
    for (let j = 0; j < 8; j++) {
      const y = 1 - (2 * (j + 0.5)) / 8,
        a = j * 2.399963;
      direction.set(
        Math.cos(a) * Math.sqrt(1 - y * y),
        y,
        Math.sin(a) * Math.sqrt(1 - y * y),
      );
      if (direction.dot(normal) < 0) direction.negate();
      ray.direction.copy(direction);
      const hit = bvh.raycastFirst(ray, DoubleSide, 0, 1.2);
      if (hit) occluded += 1 - hit.distance / 1.2;
    }
    const ao = 1 - (0.3 * occluded) / 8;
    colors.set([ao, ao, ao], i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const name = vehicles ? id : `vendor-${id.replaceAll("_", "-")}`;
  const material = new MeshStandardMaterial({
    name,
    roughness: 1,
    vertexColors: true,
  });
  const group = new Group();
  group.add(new Mesh(geometry, material));
  const out = await new GLTFExporter().parseAsync(group, { binary: true });
  await fs.writeFile(`public/assets/models/${name}.glb`, Buffer.from(out));
  const meta = await fs.readFile(`${file}.meta`, "utf8");
  const guid = meta.match(
    /name: texture_pbr_20250901\n\s+second: \{fileID: \d+, guid: (\w+)/,
  )?.[1];
  const texture = guidPaths.get(guid);
  if (!texture) throw Error(`No albedo GUID resolution for ${id}`);
  await sharp(texture)
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .webp({ quality: 85 })
    .toFile(`public/assets/textures/${name}.webp`);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new Vector3()).toArray();
  catalog.models[name] = {
    source: `Assets/Models/${id}.fbx`,
    texture: path.relative(project, texture),
    size,
    triangles: geometry.index.count / 3,
    bytes: out.byteLength,
  };
  console.log(
    name,
    size.map((n) => +n.toFixed(2)),
    Math.round(out.byteLength / 1024) + "KB",
  );
}
await fs.writeFile(
  `public/assets/world/${vehicles ? "transport" : "vendor"}-catalog.json`,
  JSON.stringify(catalog, null, 2),
);
await fs.writeFile(
  `public/assets/licenses/${vehicles ? "transport" : "vendor"}-assets.json`,
  JSON.stringify(
    {
      ...catalog,
      conversion:
        "Original meshes merged by shared source albedo, ground-centred and scaled to estimated real-world dimensions. Eight-ray local vertex AO baked offline. Albedo capped at 1024px and encoded as opaque WebP; no KTX2 or GPU texture compression. Texture assignments resolved from Unity importer GUIDs. Geometry is static; moving traffic is driven by the game ECS, not Unity scripts. No separate asset-specific license in the supplied model folders; project README preserved in hide-and-seek-platformer-readme.txt.",
    },
    null,
    2,
  ),
);
