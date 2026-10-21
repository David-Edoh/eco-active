# Roadside commerce validation

All six requested Unity models appear as 35 authored stalls. Regional counts are
31 in commercial/church/junction clusters and four on quieter approaches; they
are a photo-informed interpretation, not a surveyed vendor census. Six existing
NPCs become idle attendants; total ambient population remains twelve.

## Checks

- Lint, strict TypeScript and production build pass.
- Independent Clipper polygon intersections verify no stall overlaps the park,
  existing buildings or road corridors with 0.6m clearance. All six models are
  represented; adjacent stalls do not overlap; player collision blocks the stalls
  while original open road centres remain open.
- NPC checks verify six stationary ECS attendants, total population twelve,
  distance-based render destruction and complete NPC teardown.
- The standard streaming test passes its two-load limit, warm-up, swaps, eviction
  and buffer teardown checks. Stalls reuse that same lifecycle.
- The authored placement rebuild is idempotent and does not change OSM records.
- Browser checks pass with zero page/console/asset errors. Loaded stalls use
  textured GPU instance groups with finite positive culling bounds. Market, sparse
  roadside, mobile and unobstructed asset-lineup screenshots were inspected.

## Measurement conditions

Hardware: Apple M2, darwin. Headless Chrome 156.0.8078.4.
Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver).

| View | Viewport | Quality | Frame ms | Draw calls |
| --- | --- | --- | ---: | ---: |
| overview | 1440×900 | Auto | 360.6 | 272 |
| church-market | 1440×900 | Auto | 390.4 | 224 |
| east-market | 1440×900 | Auto | 354.2 | 207 |
| quiet-edge | 1440×900 | Auto | 336.3 | 207 |
| mobile | 390×844 | Performance | 197.5 | 93 |

These are software-renderer validation samples, not native Apple GPU benchmarks.
Mobile uses viewport/touch emulation, not a physical phone. Auto render scale can
change during the run; exact telemetry and scale are in vendors-results.json.
The temporary asset lineup is placed above the city for unobstructed inspection
only and is destroyed with its test page; it is never part of the runtime world.
No KTX2/Basis support, GPU block compression or device-specific performance claim
is implied by the WebP assets.

## Commands

`node --import tsx scripts/test-vendors.mjs`

`node --import tsx scripts/test-streaming.mjs`

`GAME_TEST_URL=http://127.0.0.1:3100 node scripts/test-vendors-browser.mjs`
