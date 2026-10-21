# Ground, material and vehicle-facing verification

Verified 2026-10-21 on an Apple M2 host using headless Chrome and ANGLE SwiftShader
software rendering. Quality auto; observed render scale 0.9. Mobile viewport/touch
emulation is not a physical phone benchmark. Single HUD snapshot measurements:

| View | Viewport | Frame time | Draw calls |
| --- | --- | --- | --- |
| Desktop | 1440 × 900 | 370.4 ms | 157 |
| Mobile emulation | 390 × 844 | 181.8 ms | 155 |

Inspected desktop, mobile, overhead, and base-only screenshots. The base-only view
hides the streamed chunks to verify coverage while detailed geometry is absent.
For each viewport, tested the actual base mesh at 130,321 one-metre-grid locations
throughout [-180, 180]²: zero uncovered points and correct upward winding. The base
extends another 192m beyond movement bounds on every side. Original tapered curb
tiles are omitted from rendering; their top geometry is rectified into the shared
sealed base. Road triangulation checks also pass all 2,134 road/pavement triangles.

All inspected road/ground/pavement materials disable skybox reflection, metalness,
and specular response. Both browser views recorded zero page, console, or HTTP
errors. There are 24 traffic entities. Rendered sedan/sports instance-forward vectors
align with their route yaw (dot products >0.9); no wagon was within the render
radius during these captures. Separately inspected the original FBX front bumper/
splitter positions after conversion: sedan front -Z, wagon front +Z, sports front +Z.
The runtime now uses heading offsets 180°, 0°, and 0° respectively.

Passed `npm run lint`, `npx tsc --noEmit`, `npm run build`,
`node scripts/test-road-surfaces.mjs`, and
`node scripts/test-ground-traffic-browser.mjs`. Screenshots and raw results are
stored alongside this report. These software-rendering snapshots do not establish
physical GPU or phone performance.
