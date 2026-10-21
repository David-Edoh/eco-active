import type { District } from "../types";

export type TrafficPoint = readonly [number, number];

/** Shortest signed angular distance, including the -180/180 seam. */
export function trafficAngleDelta(from: number, to: number) {
  return ((((to - from + 540) % 360) + 360) % 360) - 180;
}

function segmentHeading(from: TrafficPoint, to: TrafficPoint) {
  return (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
}

/** Interpolate vertex tangents instead of snapping to each polyline segment. */
export function trafficHeading(
  route: readonly TrafficPoint[],
  waypoint: number,
  progress: number,
) {
  const count = route.length;
  const previous = route[(waypoint + count - 1) % count];
  const a = route[waypoint];
  const b = route[(waypoint + 1) % count];
  const next = route[(waypoint + 2) % count];
  const current = segmentHeading(a, b);
  const start =
    current + trafficAngleDelta(current, segmentHeading(previous, a)) / 2;
  const end = current + trafficAngleDelta(current, segmentHeading(b, next)) / 2;
  const t = Math.min(
    1,
    Math.max(0, progress / Math.hypot(b[0] - a[0], b[1] - a[1])),
  );
  return start + trafficAngleDelta(start, end) * t;
}

/** Closed road-network walks, with opposite directions on separate lane offsets. */
export function createTrafficRoutes(
  roads: District["roads"],
): TrafficPoint[][] {
  const nodes = new Map<string, { point: TrafficPoint; edges: number[] }>();
  const edges: { a: string; b: string; width: number }[] = [];
  const key = (p: number[]) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  for (const road of roads) {
    if (road.width < 7) continue;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1],
        b = road.points[i];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) continue;
      for (const p of [a, b]) {
        if (!nodes.has(key(p)))
          nodes.set(key(p), { point: [p[0], p[1]], edges: [] });
      }
      const index = edges.length;
      edges.push({ a: key(a), b: key(b), width: road.width });
      nodes.get(key(a))!.edges.push(index);
      nodes.get(key(b))!.edges.push(index);
    }
  }
  const visited = new Set<number>();
  const routes: TrafficPoint[][] = [];
  for (const [start, node] of nodes) {
    if (node.edges.every((e) => visited.has(e))) continue;
    const route: TrafficPoint[] = [];
    const traverse = (from: string, to: string, width: number) => {
      const a = nodes.get(from)!.point,
        b = nodes.get(to)!.point;
      const dx = b[0] - a[0],
        dz = b[1] - a[1];
      const length = Math.hypot(dx, dz),
        lane = Math.min(1.8, width / 4);
      const inset = Math.min(4, length / 4);
      for (const distance of [inset, length - inset]) {
        route.push([
          a[0] + (dx * distance) / length + (dz / length) * lane,
          a[1] + (dz * distance) / length - (dx / length) * lane,
        ]);
      }
    };
    // Traverse each connected road out and back. Closure is geometric, never a teleport.
    const walk = (at: string) => {
      for (const index of nodes.get(at)!.edges) {
        if (visited.has(index)) continue;
        visited.add(index);
        const edge = edges[index],
          next = edge.a === at ? edge.b : edge.a;
        traverse(at, next, edge.width);
        walk(next);
        traverse(next, at, edge.width);
      }
    };
    walk(start);
    // Round junctions and dead-end U-turns while retaining the lane corridor.
    let rounded = route;
    for (let pass = 0; pass < 2; pass++) {
      const next: TrafficPoint[] = [];
      for (let i = 0; i < rounded.length; i++) {
        const a = rounded[i],
          b = rounded[(i + 1) % rounded.length];
        next.push(
          [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
          [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
        );
      }
      rounded = next;
    }
    if (rounded.length) routes.push(rounded);
  }
  return routes;
}

/** Consumes overshoot across any number of waypoints, including the closing edge. */
export function advanceTraffic(
  route: readonly TrafficPoint[],
  state: { waypoint: number; progress: number },
  distance: number,
) {
  while (distance > 0) {
    const a = route[state.waypoint],
      b = route[(state.waypoint + 1) % route.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const remaining = length - state.progress;
    if (distance < remaining) {
      state.progress += distance;
      break;
    }
    distance -= remaining;
    state.progress = 0;
    state.waypoint = (state.waypoint + 1) % route.length;
  }
}
