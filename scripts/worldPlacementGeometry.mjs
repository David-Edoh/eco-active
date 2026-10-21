// Shared offline placement geometry; no browser/runtime imports.
export function inside(x, z, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
export function distance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export function corners(item, pad = 0) {
  const a = (-item.yaw * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, z]) => [
    item.x + x * (item.w / 2 + pad) * c - z * (item.d / 2 + pad) * s,
    item.z + x * (item.w / 2 + pad) * s + z * (item.d / 2 + pad) * c,
  ]);
}
export function overlap(a, b, pad = 0) {
  const aa = corners(a, pad),
    bb = corners(b);
  for (const poly of [aa, bb])
    for (let i = 0; i < 4; i++) {
      const next = poly[(i + 1) % 4],
        dx = next[0] - poly[i][0],
        dz = next[1] - poly[i][1],
        axis = [-dz, dx];
      const ap = aa.map((p) => p[0] * axis[0] + p[1] * axis[1]),
        bp = bb.map((p) => p[0] * axis[0] + p[1] * axis[1]);
      if (
        Math.max(...ap) <= Math.min(...bp) ||
        Math.max(...bp) <= Math.min(...ap)
      )
        return false;
    }
  return true;
}
