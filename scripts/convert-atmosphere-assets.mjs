// Usage: node scripts/convert-atmosphere-assets.mjs /path/to/advanced-multiplayer-template
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
} from "three";
const source = process.argv[2];
if (!source) throw Error("Supply the Unity asset directory");
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
async function save(name, group, animations = []) {
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
      const name = ms[group.materialIndex]?.name || "default";
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

// Additional exterior meshes share the existing session materials.
for (const [name, file, rotate, color] of [
  ["wagon", "Models/SedanCar2/model/PioneerSW80.fbx", true, "wagon-paint"],
  ["sports", "Models/SportCar2/model/Phoenix445.fbx", false, "sports-paint"],
]) {
  const root = await read(file);
  const meshes = [];
  root.traverse((n) => {
    if (
      !n.isMesh ||
      /inner|interior|seat|dashboard|steering|gearknob|doorcard|engine|suspension|exhaust/i.test(
        n.name,
      )
    )
      return;
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      if (/^body$/i.test(m.name)) m.name = color;
      else if (/rim|tire/i.test(m.name)) m.name = "RIMSTOCK_07";
      else if (/lights/i.test(m.name)) m.name = "Riverside88_lights_glass";
    }
    meshes.push(n);
  });
  const bounds = new Box3().setFromObject(root).getSize(new Vector3());
  await save(
    name,
    staticAsset(meshes, 4.7 / Math.max(bounds.x, bounds.z), rotate),
  );
}
// RGBE remains HDR; cap panorama dimensions offline (GPU conversion uses 256px faces).
const { HDRLoader } = await import("three/addons/loaders/HDRLoader.js");
const { FloatType } = await import("three");
const hdrFile = "Models/City/Skybox/Textures/Afternoon_Skybox.hdr";
const bytes = await fs.readFile(path.join(source, hdrFile));
const hdr = new HDRLoader()
  .setDataType(FloatType)
  .parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
const width = Math.min(1024, hdr.width),
  height = Math.round((hdr.height * width) / hdr.width);
const pixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const src =
      (Math.floor((y * hdr.height) / height) * hdr.width +
        Math.floor((x * hdr.width) / width)) *
      4;
    const rgb = [hdr.data[src], hdr.data[src + 1], hdr.data[src + 2]];
    const max = Math.max(...rgb),
      offset = (y * width + x) * 4;
    if (max > 1e-32) {
      const exp = Math.floor(Math.log2(max)) + 1;
      const scale = 256 / 2 ** exp;
      for (let c = 0; c < 3; c++)
        pixels[offset + c] = Math.min(255, Math.floor(rgb[c] * scale));
      pixels[offset + 3] = exp + 128;
    }
  }
await fs.writeFile(
  `${out}/textures/afternoon-sky.hdr`,
  Buffer.concat([
    Buffer.from(
      `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`,
    ),
    pixels,
  ]),
);
for (const [file, name] of [["Models/SportCar2/License.txt", "sports.txt"]]) {
  await fs.copyFile(path.join(source, file), `${out}/licenses/${name}`);
}
await fs.writeFile(
  `${out}/licenses/atmosphere-assets.json`,
  JSON.stringify(
    {
      source: "Advanced Multiplayer Template",
      models: {
        wagon: "Models/SedanCar2/model/PioneerSW80.fbx",
        sports: "Models/SportCar2/model/Phoenix445.fbx",
      },
      sky: hdrFile,
      conversion:
        "Exterior meshes, normalized to 4.7m length; HDR panorama capped at 1024px width. Existing template notices apply.",
    },
    null,
    2,
  ),
);
