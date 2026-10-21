import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createTrafficRoutes,
  advanceTraffic,
} from "../src/playcanvas/systems/trafficRoutes";
import type { District } from "../src/playcanvas/types";
const district: District = JSON.parse(
  readFileSync("public/assets/world/district.json", "utf8"),
);
for (const roads of [
  district.roads,
  district.roads.filter((road) => road.width >= 10),
  [
    {
      name: "Dead end",
      width: 7,
      points: [
        [0, 0],
        [20, 0],
        [20, 20],
      ],
    },
  ],
]) {
  const routes = createTrafficRoutes(roads);
  assert(routes.length > 0);
  for (const route of routes) {
    const state = { waypoint: 0, progress: 0 };
    let length = 0;
    for (let i = 0; i < route.length; i++) {
      const a = route[i],
        b = route[(i + 1) % route.length];
      const segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
      assert(segment > 0, "No degenerate segments");
      length += segment;
    }
    const position = () => {
      const a = route[state.waypoint],
        b = route[(state.waypoint + 1) % route.length];
      const t = state.progress / Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    const visited = new Set<number>();
    // Exercise multiple complete laps, turns, and exact endpoint overshoot.
    for (let travelled = 0; travelled < length * 2.1; travelled += 0.5) {
      const before = position();
      advanceTraffic(route, state, 0.5);
      const after = position();
      assert(
        Math.hypot(after[0] - before[0], after[1] - before[1]) <= 0.500001,
        "No teleport at any waypoint or wrap",
      );
      visited.add(state.waypoint);
    }
    assert(visited.size > 4);
  }
  console.log(
    `Verified ${routes.length} connected routes through multiple laps`,
  );
}
assert.deepEqual(createTrafficRoutes([]), []);
