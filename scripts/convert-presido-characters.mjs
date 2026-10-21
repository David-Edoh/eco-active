// Offline only: node scripts/convert-presido-characters.mjs /path/to/presido
// Or: node scripts/convert-presido-characters.mjs /path/to/hide-and-seek --hide-and-seek
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {
  AnimationMixer,
  AnimationClip,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  Quaternion,
  Vector3,
  Box3,
  Group,
  MeshStandardMaterial,
  TextureLoader,
  Texture,
  LoopOnce,
} from "three";
const project = process.argv[2];
if (!project) throw new Error("Supply the Presido Unity project directory");
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
const buffer = await fs.readFile("public/assets/models/character.glb");
const original = await new GLTFLoader().parseAsync(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  "",
);
const source = original.scene;
source.updateMatrixWorld(true);
const sourceBones = new Map();
source.traverse((n) => {
  if (n.isBone)
    sourceBones.set(n.name, {
      node: n,
      inverse: n.getWorldQuaternion(new Quaternion()).invert(),
      position: n.position.clone(),
      rotation: n.quaternion.clone(),
    });
});
const hideAndSeek = process.argv.includes("--hide-and-seek");
const assetRoot = "Assets/PLAYER TWO/Platformer Project/Examples";
const prefix = hideAndSeek ? "hide-and-seek" : "presido";
const variants = hideAndSeek
  ? [
      ["jarvis", "Jarvis", "jarvis", "jarvis", 1.75],
      ["adebayo", "Adebayo", "adebayo", "adebayo", 1.8],
    ]
  : [
      ["ratel", "Ratel Presido", "vdm", "vdm", 1.8],
      ["peter-obi", "Peter Obi", "peter_obi_2", "peter_mat", 1.8],
      ["indaboski", "Indaboski Bahose", "indaboski", "indaboski", 1.85],
      ["bola-tinubu", "Bola Tinubu", "bola_2", "bola_mat", 1.72],
    ];
const manifest = [];
for (const [id, label, file, textureDir, height] of variants) {
  const modelPath = hideAndSeek
    ? `${assetRoot}/Models/${file}.fbx`
    : `Assets/Models/${file}.fbx`;
  const data = await fs.readFile(path.join(project, modelPath));
  const target = new FBXLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
  );
  target.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(target);
  const wrapper = new Group();
  wrapper.name = `character-${id}`;
  wrapper.scale.setScalar(height / bounds.getSize(new Vector3()).y);
  // Ground and centre in bind pose. Keep source geometry and skeleton transforms intact.
  const centre = bounds.getCenter(new Vector3());
  const offset = new Group();
  offset.position.set(-centre.x, -bounds.min.y, -centre.z);
  offset.add(target);
  wrapper.add(offset);
  wrapper.updateMatrixWorld(true);
  const bones = [];
  const names = new Map();
  target.traverse((n) => {
    const originalName = n.isBone
      ? n.name.replace(/^mixamorig\d*[:_]?/, "")
      : n.name;
    const count = names.get(originalName) ?? 0;
    names.set(originalName, count + 1);
    n.name = count ? `${originalName}_${count}` : originalName;
    if (n.isBone && sourceBones.has(originalName))
      bones.push({
        node: n,
        source: sourceBones.get(originalName),
        bind: n.getWorldQuaternion(new Quaternion()),
        position: n.position.clone(),
      });
    if (n.isMesh) {
      if (n.isSkinnedMesh) n.normalizeSkinWeights();
      if (hideAndSeek) n.geometry = mergeVertices(n.geometry);
      const convertMaterial = (material) =>
        new MeshStandardMaterial({
          name: `${prefix}-${id}${id === "adebayo" && /hair/i.test(material.name) ? "-hair" : ""}`,
          roughness: 0.9,
        });
      n.material = Array.isArray(n.material)
        ? n.material.map(convertMaterial)
        : convertMaterial(n.material);
    }
  });
  const bindWorld = new Map();
  target.traverse((n) =>
    bindWorld.set(n, n.getWorldQuaternion(new Quaternion())),
  );
  const clips = [];
  for (const clip of original.animations) {
    for (const b of sourceBones.values()) {
      b.node.position.copy(b.position);
      b.node.quaternion.copy(b.rotation);
    }
    const mixer = new AnimationMixer(source);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const frames = Math.max(2, Math.round(clip.duration * 30) + 1);
    const times = Float32Array.from(
      { length: frames },
      (_, i) => (i * clip.duration) / (frames - 1),
    );
    const rotations = bones.map(() => new Float32Array(frames * 4));
    const hips = bones.filter((b) => b.source.node.name === "Hips");
    const positions = hips.map(() => new Float32Array(frames * 3));
    for (let f = 0; f < frames; f++) {
      mixer.setTime(times[f]);
      source.updateMatrixWorld(true);
      const desired = new Map(
        bones.map((b) => [
          b.node,
          b.source.node
            .getWorldQuaternion(new Quaternion())
            .multiply(b.source.inverse)
            .multiply(b.bind),
        ]),
      );
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i];
        const parent =
          desired.get(b.node.parent) ??
          bindWorld.get(b.node.parent) ??
          new Quaternion();
        const local = parent
          .clone()
          .invert()
          .multiply(desired.get(b.node))
          .normalize();
        rotations[i].set(local.toArray(), f * 4);
      }
      for (let i = 0; i < hips.length; i++) {
        const b = hips[i];
        const bob =
          clip.name === "Jump"
            ? 0
            : ((b.source.node.position.y - b.source.position.y) *
                b.position.y) /
              b.source.position.y;
        positions[i].set(
          [b.position.x, b.position.y + bob, b.position.z],
          f * 3,
        );
      }
    }
    const tracks = bones.map(
      (b, i) =>
        new QuaternionKeyframeTrack(
          `${b.node.name}.quaternion`,
          times,
          rotations[i],
        ),
    );
    hips.forEach((b, i) =>
      tracks.push(
        new VectorKeyframeTrack(`${b.node.name}.position`, times, positions[i]),
      ),
    );
    clips.push(new AnimationClip(clip.name, clip.duration, tracks));
    mixer.stopAllAction();
    mixer.uncacheRoot(source);
  }
  const result = await new GLTFExporter().parseAsync(wrapper, {
    binary: true,
    animations: clips,
  });
  await fs.writeFile(
    `public/assets/models/character-${id}.glb`,
    Buffer.from(result),
  );
  const texturePath = hideAndSeek
    ? `${assetRoot}/Textures/Models/${textureDir}/${id === "adebayo" ? "Ch12_1001_Diffuse.png" : "texture_pbr_20250901.png"}`
    : `Assets/Models/${textureDir}/texture_pbr_20250901.png`;
  await sharp(path.join(project, texturePath))
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toFile(`public/assets/textures/character-${id}.webp`);
  manifest.push({
    id,
    label,
    model: modelPath,
    texture: texturePath,
    height,
    bytes: result.byteLength,
    clips: clips.map((c) => c.name),
  });
  console.log(
    id,
    Math.round(result.byteLength / 1024),
    "KB",
    bones.length,
    "animated bones",
  );
}
if (hideAndSeek) {
  await fs.copyFile(
    path.join(project, assetRoot, "..", "README.txt"),
    "public/assets/licenses/hide-and-seek-platformer-readme.txt",
  );
} else {
  await fs.copyFile(
    path.join(project, "Assets/EndlessRunner_Third-PartyNotice.txt"),
    "public/assets/licenses/presido-third-party-notice.txt",
  );
}
await fs.writeFile(
  `public/assets/licenses/${prefix}-characters.json`,
  JSON.stringify(
    {
      source: hideAndSeek
        ? "User-supplied Hide and Seek Unity project"
        : "User-supplied Presido Unity project",
      conversion:
        "Original skinned meshes and albedo atlases; textures capped at 1024px. Existing StarterAssets locomotion retargeted at 30 Hz, including separate accessory skeletons. Mixamo bone prefixes normalized, skin weights normalized to the supported four influences. Body/hair material groups preserved; hair uses alpha cutout at runtime. Runtime uses only local converted files.",
      notices: hideAndSeek
        ? "Platformer Project README preserved. No separate character-specific license found beside these assets."
        : "Supplied third-party notice preserved. No separate character-specific license found beside these assets.",
      characters: manifest,
    },
    null,
    2,
  ),
);
