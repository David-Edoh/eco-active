# Building research and variation validation

21 October 2026. Research and per-footprint evidence are recorded in
`docs/references/buildings/research.md`, `assignments.json` and `placement-audit.json`.
All model URLs use local public/assets files; source City FBX is checked in locally.
No new dependencies or runtime third-party map/photo service was introduced.

Passed lint, TypeScript, optimized production build, 132-placement validation,
2,134-triangle road validation, multi-lap traffic route checks, and desktop/mobile
browser verification. The latter inspects catalog models, at least five loaded
material profiles, persistent skyline residency, 340m camera far clip and zero
console/page/HTTP errors. Screenshots were inspected for spawn, church, CBN close
view, skyline, north-side commercial frontage and overhead, plus mobile spawn and
church. Earlier screenshots caught incorrect single-material BoxGeometry group
assignment and a brick texture on the church plaster; both were corrected and
browser verification repeated before delivery.

The placement test checks unique OSM IDs, oriented rectangle containment of every
original projected footprint vertex, model-bound scaling, catalog/profile validity,
height provenance and exactly one render owner (chunk or skyline) for each building.
Five tall buildings are retained in the skyline; 127 ordinary/landmark placements
remain eligible for distance-based chunk streaming.

## Measurement conditions

Host: Apple M2; headless Chrome reports ANGLE SwiftShader software rendering.
Quality auto, observed render scale 0.9. Mobile is viewport/touch emulation, not a
physical-phone benchmark. These are single HUD snapshots at spawn, not controlled
performance comparisons with earlier versions:

| View | Viewport | Frame time | Draw calls | Triangles |
| --- | --- | --- | --- | --- |
| Desktop | 1440 × 900 | 242.4 ms | 221 | 338756 |
| Mobile emulation | 390 × 844 | 126.9 ms | 219 | 338699 |

Restoring source facade slots and keeping a small skyline adds draw calls. The
floor-band derivatives reduce unnecessary geometry for short buildings. These
software-rendering observations do not establish GPU or physical-phone performance.
Full GPU identity and raw results are in `buildings-results.json`.

## Fidelity limits

OSM positions and available height/level tags are preserved. Source footprint
polygons remain in the audit; rendered/collision outlines are fitted rectangles.
Unknown heights are labeled estimates. The source pack has three upright buildings;
four additional ordinary GLBs are derivatives with source floor bands removed and
source roofs retained. Two custom landmark silhouettes approximate features absent
from the pack. They are not surveyed replicas. The CBN's overall 99.9m height has
primary-source support, but wing dimensions, Trinity's height and both footprint
associations retain documented uncertainty. No current multi-view survey for every
facade was available.
