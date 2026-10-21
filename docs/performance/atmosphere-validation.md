# Atmosphere and population verification

Verified 2026-10-21 with local headless Chrome on an Apple M2 host. Chrome used
ANGLE/SwiftShader software rendering, not the Apple GPU. Quality: auto, observed
render scale 0.9. Mobile is viewport/touch emulation, not a physical phone test.

| Capture | Viewport | HUD frame time | Draw calls | Players |
| --- | --- | --- | --- | --- |
| Before | 1440 × 900 | 293.9 ms | 179 | 2 |
| After | 1440 × 900 | 310.1 ms | 168 | 1 |
| After, mobile emulation | 390 × 844 | 180.9 ms | 166 | 1 |

These are single HUD snapshots under software rendering, not averages or a
controlled before/after performance comparison. Different player counts also
change rendering work. Raw telemetry and GPU identity are in the matching JSON
files; screenshots were inspected at both viewport sizes. The cooler scene and
photographic sky/horizon render correctly. New wagon and sports container assets
load, the sky cubemap exists, and no browser console/page errors were recorded.

The population is 24 ambient vehicles and 12 pedestrians. Pedestrians reuse the
supplied civilian mesh with four clothing palettes and slight height differences;
the source contains only one civilian character mesh. Cars retain the existing
route/distance budgets and use three shared instancing batches. Traffic route
validation passed multiple laps for the district and a synthetic dead end.

Checks: `npm run lint`, `npx tsc --noEmit`, `npm run build`,
`node --import tsx scripts/test-traffic.ts`, and
`node scripts/test-atmosphere-browser.mjs after-mobile` passed.
Desktop captures used the same browser script before adding its sky/model
assertions; the resulting JSON confirms the sky/model checks and zero errors.

Source panorama contains generic photographic scenery. It is not an exact Lagos
skyline. Original notices are retained in public/assets/licenses; the wagon's
source folder does not include its own license file.
