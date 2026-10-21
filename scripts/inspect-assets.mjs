import fs from "node:fs";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { TextureLoader, Texture, Box3, Vector3 } from "three";
TextureLoader.prototype.load = function () {
  return new Texture();
};
const root =
  "/Users/davidedoh/ekoactive assets/assets/advanced multiplayer template/";
for (const path of [
  "Models/City/Models/City.fbx",
  "Models/SedanCar/Negotiator80.fbx",
  "Models/Character/muscular stylized man/Rigged/muscular stylized man.fbx",
]) {
  const bytes = fs.readFileSync(root + path);
  const obj = new FBXLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  console.log(
    "\nASSET",
    path,
    new Box3().setFromObject(obj).getSize(new Vector3()).toArray(),
  );
  obj.traverse((n) => {
    if (n.isMesh)
      console.log(
        n.name,
        n.geometry.attributes.position.count,
        new Box3()
          .setFromObject(n)
          .getSize(new Vector3())
          .toArray()
          .map((v) => +v.toFixed(2)),
        (Array.isArray(n.material) ? n.material : [n.material]).map(
          (m) => m.name,
        ),
      );
  });
  console.log(
    "animations",
    obj.animations.map((a) => a.name),
  );
}
