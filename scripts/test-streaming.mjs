// Run with node --import tsx scripts/test-streaming.mjs.
import assert from "node:assert/strict";
import { createGameWorld } from "../src/playcanvas/ecs/createGameWorld.ts";
import { ChunkStreamer } from "../src/playcanvas/streaming/ChunkStreamer.ts";
const item = (x, z) => ({
  kind: "building",
  model: "building-low-3",
  x,
  y: 0,
  z,
  yaw: 0,
  sx: 1,
  sy: 1,
  sz: 1,
});
const cells = [
  [-32, -32],
  [32, -32],
  [-32, 32],
  [32, 32],
];
const district = {
  chunks: cells.map(([x, z]) => ({
    id: `${Math.floor(x / 64)}_${Math.floor(z / 64)}`,
    x,
    z,
    url: `/cell/${x}/${z}`,
  })),
  buildings: [],
  park: [],
  roads: [],
  bounds: 180,
  origin: [],
  spawn: [0, 0],
  attribution: "test",
  distant: [...cells.map(([x, z]) => item(x, z)), item(320, 0)],
};
const world = createGameWorld();
const streamer = new ChunkStreamer({}, {}, district, world);
let destroyedRoots = 0,
  destroyedBuffers = 0,
  active = 0,
  maximum = 0;
streamer.build = (id) => ({
  root: {
    name: id,
    enabled: true,
    destroy() {
      destroyedRoots++;
    },
  },
  buffers: [
    {
      destroy() {
        destroyedBuffers++;
      },
    },
  ],
  meshes: [],
  entities: id.startsWith("distant-")
    ? []
    : [
        world.add({
          id: `test-${id}`,
          vehicle: true,
          parked: true,
          chunkId: id,
        }),
      ],
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  active++;
  maximum = Math.max(maximum, active);
  await new Promise((resolve) => setTimeout(resolve, 1));
  active--;
  return { ok: true, json: async () => [] };
};
try {
  await streamer.warm(0, 0);
  assert.equal(maximum, 2, "Warm-up requests are capped at two");
  assert.equal(streamer.count, 4);
  assert.equal(
    world.size,
    4,
    "Detailed parked vehicles belong to their loaded chunk",
  );
  assert(
    streamer.distant.has("5_0"),
    "Initial visible backdrop is ready before warm resolves",
  );
  for (const id of streamer.ids)
    assert(
      !streamer.distant.get(id)?.root.enabled,
      "Detailed and distant cells cannot overlap",
    );
  streamer.update(0.2, 250, 0);
  assert.equal(streamer.count, 0, "Leaving the area evicts detailed cells");
  assert.equal(world.size, 0, "Eviction removes parked vehicle ECS records");
  assert(
    destroyedRoots >= 4 && destroyedBuffers >= 4,
    "Eviction releases instance resources",
  );
  for (const id of ["0_0", "0_-1"])
    assert(
      streamer.distant.get(id)?.root.enabled,
      "An evicted detailed cell gets building coverage",
    );
  streamer.update(0.2, -180, 180);
  assert(
    !streamer.distant.has("5_0"),
    "Distant cells beyond the hysteresis range are released",
  );
  streamer.destroy();
  assert.equal(streamer.distant.size, 0);
  assert.equal(world.size, 0, "Teardown leaves no parked vehicle ECS records");
  assert.equal(streamer.distantItems.size, 0);
  assert.equal(
    destroyedRoots,
    destroyedBuffers,
    "All constructed cell resources are released together",
  );
  console.log(
    "Streaming: two-request cap, initial coverage, detail swaps, eviction and teardown passed",
  );
} finally {
  globalThis.fetch = originalFetch;
}
