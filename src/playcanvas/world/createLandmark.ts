import {
  Application,
  Entity,
  StandardMaterial,
  Color,
  Mesh,
  MeshInstance,
  Texture,
  FILTER_LINEAR,
  RenderComponent,
} from "playcanvas";
import type { District } from "../types";
import { AssetLibrary } from "../utils/assetLoader";
// Custom Tinubu Square landmark: supplied pack has no equivalent monument.
export function createLandmark(
  app: Application,
  library: AssetLibrary,
  district: District,
) {
  const root = new Entity("Tinubu Square");
  app.root.addChild(root);
  const owned: StandardMaterial[] = [];
  const textures: Texture[] = [];
  const material = (hex: string, gloss = 0.1) => {
    const m = new StandardMaterial();
    m.diffuse = new Color().fromString(hex);
    m.gloss = gloss;
    m.update();
    owned.push(m);
    return m;
  };
  const green = material("#294a3b"),
    path = material("#b7b5a4"),
    lawn = material("#52764a");
  const shape = (
    type: "box" | "cylinder" | "sphere",
    name: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: StandardMaterial,
  ) => {
    const e = new Entity(name);
    e.addComponent("render", { type, material: m });
    e.setPosition(x, y, z);
    e.setLocalScale(sx, sy, sz);
    root.addChild(e);
    return e;
  };
  // Triangulated park polygon uses the surveyed OSM boundary (custom landmark ground).
  const positions: number[] = [];
  const indices: number[] = [];
  let cx = 0,
    cz = 0;
  for (const p of district.park) {
    cx += p[0];
    cz += p[1];
  }
  cx /= district.park.length;
  cz /= district.park.length;
  positions.push(cx, 0.18, cz);
  for (const p of district.park) positions.push(p[0], 0.18, p[1]);
  for (let i = 1; i < district.park.length; i++) {
    const a = district.park[i - 1],
      b = district.park[i];
    const area = (a[0] - cx) * (b[1] - cz) - (b[0] - cx) * (a[1] - cz);
    // Clockwise in X/Z is upward-facing, regardless of OSM ring winding.
    if (area > 0) indices.push(0, i + 1, i);
    else indices.push(0, i, i + 1);
  }
  const mesh = new Mesh(app.graphicsDevice);
  mesh.setPositions(positions);
  mesh.setNormals(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)));
  mesh.setIndices(indices);
  mesh.update();
  const squareFloor = library.materials.get("pavement")!.clone();
  squareFloor.name = "Tinubu Square paved plaza";
  squareFloor.diffuse.fromString("#b7b2a4");
  squareFloor.useSkybox = false;
  squareFloor.specularityFactor = 0;
  squareFloor.metalness = 0;
  squareFloor.gloss = 0;
  squareFloor.update();
  owned.push(squareFloor);
  const ground = new Entity("Square paving");
  ground.addComponent("render", {
    meshInstances: [new MeshInstance(mesh, squareFloor, ground)],
  });
  root.addChild(ground);
  // Custom photo-informed geometry is generated offline, shared by the session
  // library, and rendered exclusively by PlayCanvas. The library owns its meshes.
  const monument = library.instantiate("tinubu-monument");
  // Center the complete three-lobed pad bounds on the mapped park centroid,
  // rather than centering only the large circle. Match build-world.py planting.
  monument.setLocalScale(1.15, 1, 1.15);
  monument.setPosition(-17.3, 0, -8.1);
  root.addChild(monument);
  // Local planted islands leave most of the reference plaza paved, rather than
  // depicting the entire fenced square as a lawn. Sizes are photo estimates.
  for (const [x, z, sx, sz] of [
    [-48, -19, 9, 4],
    [-57, -26, 10, 3],
    [3, 6, 4, 9],
    [-13, 8, 7, 3],
  ]) {
    shape(
      "cylinder",
      "Planted island coping",
      x,
      0.22,
      z,
      sx + 0.4,
      0.12,
      sz + 0.4,
      path,
    );
    shape("cylinder", "Planted island", x, 0.29, z, sx, 0.08, sz, lawn);
  }
  // A pale approach to the fountain.
  shape("box", "Fountain approach", -17.3, 0.205, 5.8, 15, 0.035, 2.5, path);
  // Landmark fence; batch its repeated pieces into one static group.
  for (let i = 0; i < district.park.length - 1; i++) {
    const a = district.park[i],
      b = district.park[i + 1],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const yaw = (-Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    for (let t = 0; t < length; t += 0.65) {
      const x = a[0] + ((b[0] - a[0]) * t) / length,
        z = a[1] + ((b[1] - a[1]) * t) / length;
      if (z > 7 && x > -40 && x < -10) continue;
      shape("box", "Square railing", x, 0.95, z, 0.045, 1.45, 0.045, green);
      if (t + 0.65 <= length) {
        for (const y of [0.38, 1.35]) {
          const rail = shape(
            "box",
            "Fence rail",
            x + ((b[0] - a[0]) * 0.325) / length,
            y,
            z + ((b[1] - a[1]) * 0.325) / length,
            0.68,
            0.055,
            0.055,
            green,
          );
          rail.setEulerAngles(0, yaw, 0);
        }
      }
    }
  }
  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    bg: string,
    fg: string,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = fg;
    ctx.font = "bold 82px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 130, 950);
    const texture = new Texture(app.graphicsDevice, {
      width: 1024,
      height: 256,
      mipmaps: true,
      minFilter: FILTER_LINEAR,
    });
    texture.setSource(canvas);
    textures.push(texture);
    const m = material("#ffffff");
    m.diffuseMap = texture;
    m.emissiveMap = texture;
    m.emissive = new Color(0.15, 0.15, 0.15);
    m.update();
    const e = shape("box", text, x, y, z, width, height, 0.12, m);
    return e;
  }

  // Park-side pavement: between the fence (z ≈ 13.2) and road edge (z ≈ 16.1).
  const streetSignX = -7;
  const streetSignZ = 14.6;
  sign(
    "BROAD STREET",
    streetSignX,
    3.2,
    streetSignZ,
    4,
    0.8,
    "#214e42",
    "#f5eedb",
  );
  shape(
    "cylinder",
    "Street sign post",
    streetSignX,
    1.6,
    streetSignZ,
    0.08,
    3.2,
    0.08,
    green,
  );
  const group = app.batcher.addGroup("Tinubu monument", false, 100);
  for (const r of root.findComponents("render") as RenderComponent[])
    r.batchGroupId = group.id;
  app.batcher.generate([group.id]);
  return {
    root,
    destroy() {
      app.batcher.removeGroup(group.id);
      root.destroy();
      mesh.destroy();
      textures.forEach((t) => t.destroy());
      owned.forEach((m) => m.destroy());
    },
  };
}
