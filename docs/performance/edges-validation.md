# District edge validation

Host: Apple M2. Headless Chrome reports ANGLE / SwiftShader software GPU.
Mobile is 390 × 844 viewport/touch emulation, not a physical-phone measurement.
These are telemetry snapshots, not a controlled before/after performance benchmark.

`node scripts/test-district-edges-browser.mjs` passed. It verifies each ordinary
mapped building has active detail or distant coverage, waits for initial backdrop
cells, requires building draw calls to survive frustum culling, checks page/network
errors, and captures the square and four cardinal edge camera positions. The
camera is repositioned for these views; this is not a physical walk to each edge.
Desktop screenshots and the mobile south screenshot were visually inspected.

| View | Viewport | Quality | Frame time (ms) | Draw calls |
| --- | --- | --- | ---: | ---: |
| square-north | 1440 × 900 | auto | 480.3 | 277 |
| north | 1440 × 900 | auto | 457.1 | 260 |
| east | 1440 × 900 | auto | 340.3 | 56 |
| south | 1440 × 900 | auto | 308.8 | 56 |
| west | 1440 × 900 | auto | 262.9 | 81 |
| mobile-south | 390 × 844 | performance | 164.2 | 18 |

`node --import tsx scripts/test-streaming.mjs` passed: capped warm-up requests,
initial distant coverage, no overlapping detail/proxy cells, detailed eviction,
distant eviction and paired instance-resource teardown. It uses a mocked graphics
boundary; actual GPU resource leak measurements were not performed.

`npm run lint`, `npx tsc --noEmit`, and `npm run build` passed.

An intermediate screenshot run exposed RenderComponent resetting custom bounds.
The final version assigns bounds after component attachment. An intermediate
frame-by-frame loading attempt exceeded the 90-second readiness timeout under
software rendering; bounded initial preparation now completes before Ready,
and the final desktop and mobile runs passed.

The 140 outer scenic placements are intentionally fictional. They reuse local
Unity-derived geometry and do not extend collision, mapped footprints, roads,
multiplayer authority or playable bounds. Bare ground beyond the walking district
is scenery, with a finite surrounding building backdrop rather than an empty
horizon. Architectural survey accuracy is not claimed for that backdrop.
