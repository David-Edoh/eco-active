import { Application, Mesh, MeshInstance } from "playcanvas";
import type { RenderComponent } from "playcanvas";
import { DISTRICT_VIEW_DISTANCE } from "./viewSettings";
import type { AssetLibrary } from "../utils/assetLoader";

/** Rectify the supplied Unity curb's top face into a sealed district base. */
export function createGround(
  app: Application,
  library: AssetLibrary,
  bounds: number,
) {
  // The source slab is a tapered quadrilateral, so scaling its bounding box
  // leaves wedges between tiles. Reuse its top triangles, fitted to the map.
  const root = library.instantiate("street-slab");
  root.name = "Sealed district ground";
  const render = (root.findComponents("render") as RenderComponent[])[0];
  const source = render.meshInstances[0].mesh!;
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  source.getPositions(positions);
  source.getNormals(normals);
  source.getIndices(indices);
  const top: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3);
    if (triangle.every((index) => normals[index * 3 + 1] > 0.99))
      top.push(...triangle);
  }
  if (top.length !== 6) {
    root.destroy();
    throw new Error(
      "The supplied street slab must have a two-triangle top face",
    );
  }
  // Extend beyond the movement boundary by the camera far clip distance.
  const extent = bounds + DISTRICT_VIEW_DISTANCE + 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = Math.sign(positions[i]) * extent;
    positions[i + 1] = 0;
    positions[i + 2] = Math.sign(positions[i + 2]) * extent;
  }
  const mesh = new Mesh(app.graphicsDevice);
  mesh.setPositions(positions);
  mesh.setNormals(normals);
  mesh.setUvs(
    0,
    positions.flatMap((_, i) =>
      i % 3 === 0 ? [positions[i], positions[i + 2]] : [],
    ),
  );
  mesh.setIndices(top);
  mesh.update();
  const instance = new MeshInstance(
    mesh,
    library.materials.get("ground")!,
    render.entity,
  );
  render.meshInstances = [instance];
  render.castShadows = false;
  render.receiveShadows = true;
  app.root.addChild(root);
  return {
    destroy() {
      root.destroy();
      mesh.destroy();
    },
  };
}
