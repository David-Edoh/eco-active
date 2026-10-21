# Road junction validation

The Unity City FBX inventory is in `docs/references/road-asset-inventory.json`.
No named modular T/45-degree asphalt prefabs were found. Arbitrary-angle map
surfaces reuse the existing copied Unity-derived road and paving materials;
fixed authored sidewalk shapes are not claimed as exact map matches.

`node scripts/test-road-surfaces.mjs` verifies all 2,134 generated triangles:
upward winding, non-degenerate area, 64 m chunk bounds, no duplicated surface
area, OSM way/node provenance and coverage of mapped segment midpoints.
Asphalt/sidewalk overlap is checked with a 0.05 m² aggregate tolerance over the
whole district for millimetre-grid polygon intersections. Strictly-simple polygon
output is required before triangulation to split touching sidewalk boundaries.

`node scripts/test-roads-browser.mjs` checks loading, errors, telemetry and
screenshots on desktop (1440 × 900) and Pixel 7 emulation (412 × 915), auto quality.
`roads-results.json` contains the actual host CPU, Chrome version, frame time,
resolution and draw calls. These are short headless smoke-test samples, not a
physical-phone benchmark. The overhead inspection disables distance fog and
positions the diagnostic camera above the currently streamed area only.

`npm run lint`, `npx tsc --noEmit`, `npm run build` and `git diff --check` pass.
The browser run is slow on this headless host; no performance improvement is
claimed. Geometry/connection correctness is the scope of this change.
