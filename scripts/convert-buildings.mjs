// Usage: node scripts/convert-buildings.mjs src/assets/models/roads
// Three.js is used offline for conversion only; the game renders with PlayCanvas.
import fs from "node:fs/promises";
import path from "node:path";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import {
  TextureLoader,
  Texture,
  Box3,
  Vector3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Float32BufferAttribute,
  BufferGeometry,
  Ray,
  DoubleSide,
  BoxGeometry,
  CylinderGeometry,
  Shape,
  ExtrudeGeometry,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
const source = process.argv[2];
if (!source) throw Error("Supply the repository source model directory");
const out = "public/assets";
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
async function read(file) {
  const b = await fs.readFile(path.join(source, file));
  const root = new FBXLoader().parse(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
  root.updateMatrixWorld(true);
  return root;
}
function bakeAO(group) {
  const geometry = mergeGeometries(
    group.children.map((n) => {
      const g = n.geometry.clone();
      for (const k of Object.keys(g.attributes))
        if (k !== "position") g.deleteAttribute(k);
      return g.toNonIndexed();
    }),
  );
  const bvh = new MeshBVH(geometry);
  const normal = new Vector3(),
    point = new Vector3(),
    direction = new Vector3();
  const ray = new Ray();
  const directions = Array.from({ length: 12 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 12,
      a = i * 2.399963;
    return new Vector3(
      Math.cos(a) * Math.sqrt(1 - y * y),
      y,
      Math.sin(a) * Math.sqrt(1 - y * y),
    );
  });
  for (const node of group.children) {
    const g = node.geometry,
      colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      point.fromBufferAttribute(g.attributes.position, i);
      normal.fromBufferAttribute(g.attributes.normal, i).normalize();
      ray.origin.copy(point).addScaledVector(normal, 0.035);
      let occluded = 0,
        total = 0;
      for (const sample of directions) {
        direction.copy(sample);
        if (direction.dot(normal) < 0) direction.negate();
        ray.direction.copy(direction);
        const hit = bvh.raycastFirst(ray, DoubleSide, 0, 4);
        occluded += hit ? Math.max(0, 1 - hit.distance / 4) : 0;
        total++;
      }
      const ao = 1 - (0.48 * occluded) / total;
      colors.set([ao, ao, ao], i * 3);
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  }
  geometry.dispose();
}
async function save(name, group, animations = []) {
  if (name.startsWith("building-")) bakeAO(group);
  const data = await new GLTFExporter().parseAsync(group, {
    binary: true,
    onlyVisible: true,
    animations,
  });
  await fs.writeFile(`${out}/models/${name}.glb`, Buffer.from(data));
  console.log(name, Math.round(data.byteLength / 1024) + " KB");
}
const materials = new Map();
function mat(name) {
  if (!materials.has(name)) {
    const m = new MeshStandardMaterial({ roughness: 0.85 });
    m.name = name;
    materials.set(name, m);
  }
  return materials.get(name);
}
function staticAsset(nodes, scale = 1, rotate = false) {
  const grouped = new Map();
  for (const n of nodes) {
    let g = n.geometry.clone();
    g.applyMatrix4(n.matrixWorld);
    if (rotate) g.rotateY(Math.PI / 2);
    g.scale(scale, scale, scale);
    if (g.index) g = g.toNonIndexed();
    const ms = Array.isArray(n.material) ? n.material : [n.material];
    const groups = g.groups.length
      ? g.groups
      : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const group of groups) {
      const name =
        (ms.length === 1 ? ms[0] : ms[group.materialIndex])?.name || "default";
      const piece = g.clone();
      for (const attr of Object.keys(piece.attributes)) {
        if (!["position", "normal", "uv"].includes(attr))
          piece.deleteAttribute(attr);
        else {
          const a = piece.attributes[attr];
          piece.setAttribute(
            attr,
            new a.constructor(
              a.array.slice(
                group.start * a.itemSize,
                (group.start + group.count) * a.itemSize,
              ),
              a.itemSize,
            ),
          );
        }
      }
      piece.clearGroups();
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(piece);
    }
  }
  const root = new Group();
  for (const [name, gs] of grouped) {
    const g = mergeVertices(mergeGeometries(gs));
    root.add(new Mesh(g, mat(name)));
  }
  const b = new Box3().setFromObject(root),
    c = b.getCenter(new Vector3());
  for (const n of root.children) n.geometry.translate(-c.x, -b.min.y, -c.z);
  return root;
}

// The checked-in FBX is the local copy of the supplied Unity City model.
const catalog = JSON.parse(
  await fs.readFile(`${out}/world/building-catalog.json`, "utf8"),
);
const city = await read("city-source.fbx");
const inventory = [];
city.traverse((n) => {
  if (n.isMesh && n.name.startsWith("CityBuilding_"))
    inventory.push({
      name: n.name,
      size: new Box3()
        .setFromObject(n)
        .getSize(new Vector3())
        .multiplyScalar(0.01)
        .toArray(),
      materials: (Array.isArray(n.material) ? n.material : [n.material]).map(
        (m) => m.name,
      ),
    });
});
for (let i = 1; i <= 3; i++)
  await save(
    `building-${i}`,
    staticAsset([city.getObjectByName(`CityBuilding_${i}_`)], 0.01),
  );

// Derive low-rise variants by removing whole source floor bands, retaining the
// supplied ground-storey facades and actual roof geometry (no invented box kit).
function clipBand(geometry, threshold, below, shift = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const names = ["position", "normal", "uv"];
  const arrays = Object.fromEntries(names.map((name) => [name, []]));
  const vertex = (index) =>
    Object.fromEntries(
      names.map((name) => {
        const a = g.getAttribute(name);
        return [
          name,
          Array.from(
            { length: a.itemSize },
            (_, k) => a.array[index * a.itemSize + k],
          ),
        ];
      }),
    );
  const inside = (v) =>
    below ? v.position[1] <= threshold : v.position[1] >= threshold;
  for (let i = 0; i < g.getAttribute("position").count; i += 3) {
    const input = [vertex(i), vertex(i + 1), vertex(i + 2)],
      clipped = [];
    for (let j = 0; j < input.length; j++) {
      const a = input[j],
        b = input[(j + 1) % input.length],
        ai = inside(a),
        bi = inside(b);
      if (ai) clipped.push(a);
      if (ai !== bi) {
        const t = (threshold - a.position[1]) / (b.position[1] - a.position[1]);
        clipped.push(
          Object.fromEntries(
            names.map((name) => [
              name,
              a[name].map((v, k) => v + (b[name][k] - v) * t),
            ]),
          ),
        );
      }
    }
    for (let j = 1; j < clipped.length - 1; j++)
      for (const v of [clipped[0], clipped[j], clipped[j + 1]]) {
        for (const name of names)
          arrays[name].push(
            ...v[name].map((value, k) =>
              name === "position" && k === 1 ? value - shift : value,
            ),
          );
      }
  }
  if (!arrays.position.length) return null;
  const result = new BufferGeometry();
  for (const name of names)
    result.setAttribute(
      name,
      new Float32BufferAttribute(arrays[name], name === "uv" ? 2 : 3),
    );
  result.normalizeNormals();
  return result;
}
const commercial = staticAsset([city.getObjectByName("CityBuilding_2_")], 0.01);
for (const [levels, cut] of [
  [1, 2.67],
  [2, 5.34],
  [3, 9.12],
  [4, 11.79],
]) {
  const root = new Group();
  for (const source of commercial.children) {
    const pieces = [
      clipBand(source.geometry, cut, true),
      clipBand(source.geometry, 14.46, false, 14.46 - cut),
    ].filter(Boolean);
    if (pieces.length)
      root.add(
        new Mesh(mergeVertices(mergeGeometries(pieces)), source.material),
      );
  }
  const name = `building-low-${levels}`;
  const size = new Box3().setFromObject(root).getSize(new Vector3()).toArray();
  catalog.models[name] = {
    size,
    source: "CityBuilding_2_ (whole floor bands removed; source roof retained)",
    role: `${levels}-storey commercial derivative`,
  };
  await save(name, root);
}
for (const profile of [
  "commercial-cream",
  "commercial-weathered",
  "commercial-ochre",
])
  catalog.profiles[profile].levelModels = {
    1: "building-low-1",
    2: "building-low-2",
    3: "building-low-3",
    4: "building-low-4",
  };
await fs.writeFile(
  "docs/references/buildings/unity-inventory.json",
  JSON.stringify(inventory, null, 2),
);
// Custom landmark silhouettes: no matching landmark is present in the pack.
// Use locally copied Unity material textures, never internet photographs as textures.
function box(root, x, y, z, w, h, d, material) {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  root.add(new Mesh(g, mat(material)));
}
async function landmark(name, root) {
  const nodes = [];
  root.updateMatrixWorld(true);
  root.traverse((n) => {
    if (n.isMesh) nodes.push(n);
  });
  const fitted = staticAsset(nodes);
  const size = new Box3()
    .setFromObject(fitted)
    .getSize(new Vector3())
    .toArray();
  catalog.models[name].size = size;
  await save(name, fitted);
}
const church = new Group();
// Cross-section is an inverted ark; front faces +X, toward Tinubu Square.
const shape = new Shape();
shape.moveTo(-11, 3);
for (let i = 0; i <= 24; i++) {
  const z = -11 + (22 * i) / 24;
  shape.lineTo(z, 3 + 17 * Math.cos(((z / 11) * Math.PI) / 2));
}
shape.lineTo(11, 3);
shape.closePath();
const arch = new ExtrudeGeometry(shape, {
  depth: 38,
  bevelEnabled: false,
  steps: 1,
});
// Shape X = nave width, Y = height, extrusion Z = nave length.
arch.rotateY(Math.PI / 2);
arch.translate(-19, 0, 0);
church.add(new Mesh(arch, mat("default")));
box(church, 0, 0, 0, 38, 3, 22, "concrete_grey");
box(church, -15, 0, 9.5, 5, 27, 5, "default");
for (let i = 0; i < 3; i++)
  box(church, -12.45, 5, 8 + i * 1.1, 0.08, 15, 0.24, "bricks_red_2");
// Dark glazed entrance with vertical mullions and a cross on the square-facing end.
box(church, 19.1, 1, 0, 0.35, 10, 8, "WindowAtlas");
for (let z = -4; z <= 4; z += 1)
  box(church, 19.32, 1, z, 0.16, 10, 0.12, "concrete_grey");
box(church, 19.4, 11, 0, 0.2, 7, 0.55, "landmark-bronze");
box(church, 19.4, 15, 0, 0.2, 0.5, 5, "landmark-bronze");
await landmark("tinubu-trinity", church);
const bank = new Group();
// 99.9m is published by the builder; massing/wing dimensions are photo estimates.
box(bank, 0, 0, 0, 48, 20, 40, "concrete_grey");
for (let i = 0; i < 5; i++)
  for (const side of [-1, 1])
    box(bank, 0, 2 + i * 3.6, side * 20.05, 45, 1.4, 0.12, "WindowAtlas");
box(bank, -10, 20, 1, 22, 69, 34, "WindowAtlas");
box(bank, 13, 20, 5, 22, 69, 28, "WindowAtlas");
for (const x of [-21, -1, 3, 23]) box(bank, x, 20, 5, 2.2, 69, 30, "default");
for (let y = 23; y < 89; y += 4.2) {
  box(bank, -10, y, -16.1, 20, 0.35, 0.15, "concrete_grey");
  box(bank, 13, y, -9.1, 20, 0.35, 0.15, "concrete_grey");
}
const cap = new CylinderGeometry(11, 11, 10.9, 20);
cap.translate(0, 94.45, 3);
bank.add(new Mesh(cap, mat("WindowAtlas")));
box(bank, 0, 99.5, 3, 24, 0.4, 24, "concrete_grey");
await landmark("cbn-lagos", bank);
await fs.writeFile(
  `${out}/licenses/building-assets.json`,
  JSON.stringify(
    {
      source:
        "User-supplied Advanced Multiplayer Template / Models/City/Models/City.fbx",
      localSource: "src/assets/models/roads/city-source.fbx",
      sourceBuildings: [
        "CityBuilding_1_",
        "CityBuilding_2_",
        "CityBuilding_3_",
      ],
      conversion:
        "Original facade material slots preserved; one- to four-storey derivatives remove source floor bands and retain the roof; shared geometry, baked vertex ambient shading, map-fitted placements. Custom Trinity and CBN silhouettes use the supplied local materials, with measured CBN height but estimated other dimensions.",
      referenceManifest: "docs/references/buildings/research.md",
      notice:
        "Existing template-notices.txt and credits.txt apply. Photographs are research references, not redistributed runtime textures.",
    },
    null,
    2,
  ),
);

await fs.writeFile(
  `${out}/world/building-catalog.json`,
  JSON.stringify(catalog, null, 2),
);
