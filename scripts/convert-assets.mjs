// Usage: node scripts/convert-assets.mjs /path/to/advanced-multiplayer-template
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
  BufferGeometry,
  Float32BufferAttribute,
  Ray,
  DoubleSide,
  Quaternion,
  LoopOnce,
  AnimationMixer,
  AnimationClip,
  VectorKeyframeTrack,
  QuaternionKeyframeTrack,
} from "three";
import sharp from "sharp";
import { MeshBVH } from "three-mesh-bvh";
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
if (!process.argv.includes("--character-only")) {
  const city = await read("Models/City/Models/City.fbx");
  for (let i = 1; i <= 3; i++)
    await save(
      `building-${i}`,
      staticAsset([city.getObjectByName(`CityBuilding_${i}_`)], 0.01),
    );
  await save(
    "street-slab",
    staticAsset([city.getObjectByName("CityConstructionObject__34_")], 0.01),
  );
  const car = await read("Models/SedanCar/Negotiator80.fbx");
  const carMeshes = [];
  car.traverse((n) => {
    if (
      n.isMesh &&
      !/inner|interior|seat|dashboard|steering|gearknob|doorcard|engine_bay|suspension|exhaust/i.test(
        n.name,
      )
    )
      carMeshes.push(n);
  });
  const sedan = staticAsset(carMeshes, 4.7 / 194.4867, true);
  await save("sedan", sedan);
}
const character = await read(
  "Models/Character/muscular stylized man/Rigged/muscular stylized man.fbx",
);
const armRoot = await read(
  "ThirdParty/StarterAssets/ThirdPersonController/Character/Models/Armature.fbx",
);

const mapping = {
  Hips: "Hips",
  Spine: "Spine",
  Chest: "Spine1",
  UpperChest: "Spine2",
  Neck: "Neck",
  Head: "Head",
  Left_Shoulder: "LeftShoulder",
  Left_UpperArm: "LeftArm",
  Left_LowerArm: "LeftForeArm",
  Left_Hand: "LeftHand",
  Right_Shoulder: "RightShoulder",
  Right_UpperArm: "RightArm",
  Right_LowerArm: "RightForeArm",
  Right_Hand: "RightHand",
  Left_UpperLeg: "LeftUpLeg",
  Left_LowerLeg: "LeftLeg",
  Left_Foot: "LeftFoot",
  Left_Toes: "LeftToeBase",
  Right_UpperLeg: "RightUpLeg",
  Right_LowerLeg: "RightLeg",
  Right_Foot: "RightFoot",
  Right_Toes: "RightToeBase",
  Left_ThumbProximal: "LeftHandThumb1",
  Left_ThumbIntermediate: "LeftHandThumb2",
  Left_ThumbDistal: "LeftHandThumb3",
  Left_IndexProximal: "LeftHandIndex1",
  Left_IndexIntermediate: "LeftHandIndex2",
  Left_IndexDistal: "LeftHandIndex3",
  Left_MiddleProximal: "LeftHandMiddle1",
  Left_MiddleIntermediate: "LeftHandMiddle2",
  Left_MiddleDistal: "LeftHandMiddle3",
  Left_RingProximal: "LeftHandRing1",
  Left_RingIntermediate: "LeftHandRing2",
  Left_RingDistal: "LeftHandRing3",
  Right_ThumbProximal: "RightHandThumb1",
  Right_ThumbIntermediate: "RightHandThumb2",
  Right_ThumbDistal: "RightHandThumb3",
  Right_IndexProximal: "RightHandIndex1",
  Right_IndexIntermediate: "RightHandIndex2",
  Right_IndexDistal: "RightHandIndex3",
  Right_MiddleProximal: "RightHandMiddle1",
  Right_MiddleIntermediate: "RightHandMiddle2",
  Right_MiddleDistal: "RightHandMiddle3",
  Right_RingProximal: "RightHandRing1",
  Right_RingIntermediate: "RightHandRing2",
  Right_RingDistal: "RightHandRing3",
};

const boneOrder = [
  "Hips",
  "Spine",
  "Chest",
  "UpperChest",
  "Neck",
  "Head",
  "Left_Shoulder",
  "Left_UpperArm",
  "Left_LowerArm",
  "Left_Hand",
  "Left_ThumbProximal",
  "Left_ThumbIntermediate",
  "Left_ThumbDistal",
  "Left_IndexProximal",
  "Left_IndexIntermediate",
  "Left_IndexDistal",
  "Left_MiddleProximal",
  "Left_MiddleIntermediate",
  "Left_MiddleDistal",
  "Left_RingProximal",
  "Left_RingIntermediate",
  "Left_RingDistal",
  "Right_Shoulder",
  "Right_UpperArm",
  "Right_LowerArm",
  "Right_Hand",
  "Right_ThumbProximal",
  "Right_ThumbIntermediate",
  "Right_ThumbDistal",
  "Right_IndexProximal",
  "Right_IndexIntermediate",
  "Right_IndexDistal",
  "Right_MiddleProximal",
  "Right_MiddleIntermediate",
  "Right_MiddleDistal",
  "Right_RingProximal",
  "Right_RingIntermediate",
  "Right_RingDistal",
  "Left_UpperLeg",
  "Left_LowerLeg",
  "Left_Foot",
  "Left_Toes",
  "Right_UpperLeg",
  "Right_LowerLeg",
  "Right_Foot",
  "Right_Toes",
];

const parentMap = {
  Hips: null,
  Spine: "Hips",
  Chest: "Spine",
  UpperChest: "Chest",
  Neck: "UpperChest",
  Head: "Neck",
  Left_Shoulder: "UpperChest",
  Left_UpperArm: "Left_Shoulder",
  Left_LowerArm: "Left_UpperArm",
  Left_Hand: "Left_LowerArm",
  Left_ThumbProximal: "Left_Hand",
  Left_ThumbIntermediate: "Left_ThumbProximal",
  Left_ThumbDistal: "Left_ThumbIntermediate",
  Left_IndexProximal: "Left_Hand",
  Left_IndexIntermediate: "Left_IndexProximal",
  Left_IndexDistal: "Left_IndexIntermediate",
  Left_MiddleProximal: "Left_Hand",
  Left_MiddleIntermediate: "Left_MiddleProximal",
  Left_MiddleDistal: "Left_MiddleIntermediate",
  Left_RingProximal: "Left_Hand",
  Left_RingIntermediate: "Left_RingProximal",
  Left_RingDistal: "Left_RingIntermediate",
  Right_Shoulder: "UpperChest",
  Right_UpperArm: "Right_Shoulder",
  Right_LowerArm: "Right_UpperArm",
  Right_Hand: "Right_LowerArm",
  Right_ThumbProximal: "Right_Hand",
  Right_ThumbIntermediate: "Right_ThumbProximal",
  Right_ThumbDistal: "Right_ThumbIntermediate",
  Right_IndexProximal: "Right_Hand",
  Right_IndexIntermediate: "Right_IndexProximal",
  Right_IndexDistal: "Right_IndexIntermediate",
  Right_MiddleProximal: "Right_Hand",
  Right_MiddleIntermediate: "Right_MiddleProximal",
  Right_MiddleDistal: "Right_MiddleIntermediate",
  Right_RingProximal: "Right_Hand",
  Right_RingIntermediate: "Right_RingProximal",
  Right_RingDistal: "Right_RingIntermediate",
  Left_UpperLeg: "Hips",
  Left_LowerLeg: "Left_UpperLeg",
  Left_Foot: "Left_LowerLeg",
  Left_Toes: "Left_Foot",
  Right_UpperLeg: "Hips",
  Right_LowerLeg: "Right_UpperLeg",
  Right_Foot: "Right_LowerLeg",
  Right_Toes: "Right_Foot",
};

// Unity stores the calibrated humanoid reference pose in the importer metadata.
// The FBX default transforms are NOT this pose (notably the StarterAssets arms).
// Convert Unity's left-handed metres back to the FBX loader's right-handed cm.
const avatarMeta = await fs.readFile(
  path.join(
    source,
    "ThirdParty/StarterAssets/ThirdPersonController/Character/Models/Armature.fbx.meta",
  ),
  "utf8",
);
const skeletonText = avatarMeta.slice(avatarMeta.indexOf("    skeleton:"));
const referencePose = [];
for (const match of skeletonText.matchAll(
  /    - name: (.+)\n      parentName:.*\n      position: \{x: ([^,]+), y: ([^,]+), z: ([^}]+)\}\n      rotation: \{x: ([^,]+), y: ([^,]+), z: ([^,]+), w: ([^}]+)\}/g,
)) {
  const bone = armRoot.getObjectByName(match[1]);
  if (!bone) continue;
  const values = match.slice(2).map(Number);
  bone.position.set(-values[0] * 100, values[1] * 100, values[2] * 100);
  bone.quaternion.set(values[3], -values[4], -values[5], values[6]).normalize();
  referencePose.push({
    bone,
    position: bone.position.clone(),
    rotation: bone.quaternion.clone(),
  });
}
if (referencePose.length < 40)
  throw new Error("Missing Unity humanoid reference pose");
armRoot.updateMatrixWorld(true);

const srcInvBindWorld = new Map();
for (const sName of boneOrder) {
  const b = armRoot.getObjectByName(sName);
  if (b) {
    const q = new Quaternion();
    b.getWorldQuaternion(q);
    srcInvBindWorld.set(sName, q.clone().invert());
  }
}

const tgtBindWorld = new Map();
for (const sName of boneOrder) {
  const tName = mapping[sName];
  const b = character.getObjectByName(tName);
  if (b) {
    const q = new Quaternion();
    b.getWorldQuaternion(q);
    tgtBindWorld.set(tName, q);
  }
}

const armHips = armRoot.getObjectByName("Hips");
const srcHipsBindPos = armHips.getWorldPosition(new Vector3());

const mHips = character.getObjectByName("Hips");
const tgtHipsBindPos = mHips.position.clone();
const scaleFactor = mHips.getWorldPosition(new Vector3()).y / srcHipsBindPos.y;

async function retarget(animRelPath, clipName) {
  const aRoot = await read(animRelPath);
  const animClip = aRoot.animations[0];
  for (const { bone, position, rotation } of referencePose) {
    bone.position.copy(position);
    bone.quaternion.copy(rotation);
  }
  armRoot.updateMatrixWorld(true);
  const mixer = new AnimationMixer(armRoot);
  const action = mixer.clipAction(animClip);
  action.setLoop(LoopOnce, 1); // LoopOnce: sample the actual final frame, not frame zero.
  action.clampWhenFinished = true;
  action.play();

  const fps = 30;
  const numFrames = Math.max(2, Math.round(animClip.duration * fps) + 1);
  const times = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++)
    times[i] = (i / (numFrames - 1)) * animClip.duration;

  const quatArrays = new Map();
  for (const sName of boneOrder) {
    if (tgtBindWorld.has(mapping[sName])) {
      quatArrays.set(mapping[sName], new Float32Array(numFrames * 4));
    }
  }
  const hipsPosArray = new Float32Array(numFrames * 3);

  const curSrcWorld = new Map();
  const curTgtWorld = new Map();

  for (let f = 0; f < numFrames; f++) {
    const t = times[f];
    mixer.setTime(t);
    armRoot.updateMatrixWorld(true);

    for (const sName of boneOrder) {
      const b = armRoot.getObjectByName(sName);
      if (b) {
        const q = new Quaternion();
        b.getWorldQuaternion(q);
        curSrcWorld.set(sName, q);
      }
    }

    for (const sName of boneOrder) {
      const tName = mapping[sName];
      const qSrc = curSrcWorld.get(sName);
      const invSrcBind = srcInvBindWorld.get(sName);
      const qTgtBind = tgtBindWorld.get(tName);
      if (qSrc && invSrcBind && qTgtBind) {
        const delta = qSrc.clone().multiply(invSrcBind);
        const qTgtWorld = delta.multiply(qTgtBind);
        curTgtWorld.set(tName, qTgtWorld);
      }
    }

    for (const sName of boneOrder) {
      const tName = mapping[sName];
      const qWorld = curTgtWorld.get(tName);
      if (!qWorld) continue;

      const sParent = parentMap[sName];
      let qLocal;
      if (sParent) {
        const tParent = mapping[sParent];
        const qParentWorld = curTgtWorld.get(tParent);
        if (qParentWorld) {
          const invParent = qParentWorld.clone().invert();
          qLocal = invParent.multiply(qWorld);
        } else {
          qLocal = qWorld.clone();
        }
      } else {
        qLocal = qWorld.clone();
      }
      qLocal.normalize();
      quatArrays
        .get(tName)
        .set([qLocal.x, qLocal.y, qLocal.z, qLocal.w], f * 4);
    }

    const curSrcHipsPos = armHips.getWorldPosition(new Vector3());
    const deltaHips = curSrcHipsPos
      .clone()
      .sub(srcHipsBindPos)
      .multiplyScalar(scaleFactor);
    const curTgtHipsPos = tgtHipsBindPos.clone().add(deltaHips);
    // Movement/vertical jump are owned by PlayerMovement. Keep clips in place;
    // retain natural hip bob for grounded locomotion without double-moving jumps.
    hipsPosArray.set(
      [
        tgtHipsBindPos.x,
        clipName === "Jump" ? tgtHipsBindPos.y : curTgtHipsPos.y,
        tgtHipsBindPos.z,
      ],
      f * 3,
    );
  }

  const tracks = [
    new VectorKeyframeTrack("Hips.position", times, hipsPosArray),
  ];
  for (const [tName, arr] of quatArrays) {
    tracks.push(new QuaternionKeyframeTrack(`${tName}.quaternion`, times, arr));
  }

  mixer.stopAllAction();
  mixer.uncacheRoot(armRoot);
  return new AnimationClip(clipName, animClip.duration, tracks);
}

const animClips = [
  await retarget(
    "ThirdParty/StarterAssets/ThirdPersonController/Character/Animations/Stand--Idle.anim.fbx",
    "Idle",
  ),
  await retarget(
    "ThirdParty/StarterAssets/ThirdPersonController/Character/Animations/Locomotion--Walk_N.anim.fbx",
    "Walk",
  ),
  await retarget(
    "ThirdParty/StarterAssets/ThirdPersonController/Character/Animations/Locomotion--Run_N.anim.fbx",
    "Run",
  ),
  await retarget(
    "ThirdParty/StarterAssets/ThirdPersonController/Character/Animations/Jump--Jump.anim.fbx",
    "Jump",
  ),
];

const usedNames = new Map();
character.traverse((n) => {
  const name = n.name || "node";
  const count = usedNames.get(name) || 0;
  usedNames.set(name, count + 1);
  n.name = count ? `${name}_${count}` : name;
});
character.traverse((n) => {
  if (n.isMesh) {
    n.material = mat(
      (Array.isArray(n.material) ? n.material[0] : n.material).name,
    );
  }
});
const wrapper = new Group();
wrapper.add(character);
wrapper.scale.setScalar(0.105);
await save("character", wrapper, animClips);
if (!process.argv.includes("--character-only")) {
  const textures = {
    stone: "Models/City/Textures/png/BrickHouse.png",
    asphalt: "Models/City/Textures/png/Road.png",
    concrete: "Models/City/Textures/png/concrete.png",
    paving: "Models/City/Textures/png/Brick.png",
    windows: "Models/City/Textures/png/BuildingWindows02.png",
    window: "Models/City/Textures/png/BuildingWindows01.png",
    "car-bottom": "Models/SedanCar/textures/UCB_BOTTOM_DIF.png",
    "car-wheel": "Models/SedanCar/textures/RIMSTOCK_07_1_dif.png",
    "car-lights": "Models/SedanCar/textures/Riverside88_lights_dif.png",
    shirt:
      "Models/Character/muscular stylized man/OutfitStyles/Outfit0/tshart_and_body_Base_Color - Outfit0.png",
    trousers:
      "Models/Character/muscular stylized man/OutfitStyles/Outfit0/pant_and_boots_Base_Color - Outfit0.png",
    hair: "Models/Character/muscular stylized man/OutfitStyles/Outfit0/hair1_Base_Color - Outfit0.png",
  };
  const charDir = "Models/Character/muscular stylized man/texture";
  const files = await fs.readdir(path.join(source, charDir));
  const head = files.find((f) => /head.*Base.*Color/i.test(f));
  if (head) textures.head = `${charDir}/${head}`;
  for (const [name, file] of Object.entries(textures))
    await sharp(path.join(source, file))
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(`${out}/textures/${name}.webp`);
  for (const [file, name] of [
    ["Models/Character/License.txt", "character.txt"],
    ["Models/SedanCar/License.txt", "sedan.txt"],
    ["ThirdParty/Notices.txt", "template-notices.txt"],
  ])
    await fs.copyFile(path.join(source, file), `${out}/licenses/${name}`);
  await fs.writeFile(
    `${out}/licenses/asset-manifest.json`,
    JSON.stringify(
      {
        source: "User-provided Advanced Multiplayer Template",
        conversion:
          "FBX geometry converted to GLB; static parts merged by material; textures resized to <=1024 and WebP encoded. Car interior omitted.",
        models: [
          "City/Models/City.fbx",
          "SedanCar/Negotiator80.fbx",
          "Character/muscular stylized man/Rigged/muscular stylized man.fbx",
        ],
        textures,
      },
      null,
      2,
    ),
  );

  // Decode the supplied Unity serialized fern mesh without substituting primitives.
  const fernText = await fs.readFile(
    path.join(source, "Models/City/Terrain/Details/Models/Fern_C.asset"),
    "utf8",
  );
  const vertexBytes = Buffer.from(
    fernText.match(/_typelessdata: ([a-f0-9]+)/i)[1],
    "hex",
  );
  const indexBytes = Buffer.from(
    fernText.match(/m_IndexBuffer: ([a-f0-9]+)/i)[1],
    "hex",
  );
  const fernGeometry = new BufferGeometry();
  for (const [name, offset, size] of [
    ["position", 0, 3],
    ["normal", 12, 3],
    ["uv", 40, 2],
  ]) {
    const values = [];
    for (let i = 0; i < 342; i++)
      for (let j = 0; j < size; j++)
        values.push(vertexBytes.readFloatLE(i * 56 + offset + j * 4));
    fernGeometry.setAttribute(name, new Float32BufferAttribute(values, size));
  }
  fernGeometry.setIndex(
    Array.from({ length: indexBytes.length / 2 }, (_, i) =>
      indexBytes.readUInt16LE(i * 2),
    ),
  );
  const fern = new Group();
  fern.add(new Mesh(fernGeometry, mat("fern")));
  await save("fern", fern);
  await sharp(
    path.join(
      source,
      "Models/City/Terrain/Details/Textures/Fern_BaseColor.tif",
    ),
  )
    .resize(512, 512, { fit: "inside" })
    .webp({ quality: 80 })
    .toFile(`${out}/textures/fern.webp`);
}
