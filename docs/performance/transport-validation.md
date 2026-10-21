# Bus and keke validation

Four buses and four kekes join the moving fleet, keeping its total at 24. Twelve
parked vehicles form three clusters: four buses and five kekes near Custom Street,
and three kekes near Alli Street. Cluster positions are authored estimates, not
surveyed parking bays. Original source paint/mesh details are preserved.

## Verification

- npm run lint, npx tsc --noEmit, and npm run build pass.
- Independent Clipper intersection tests pass for all twelve parked footprints
  against roads with 0.7m clearance, park, buildings, stalls and each other. Chunk
  placement IDs are unique/consistent, shop attendant access remains clear, and
  parked vehicles block the existing player/camera movement checks.
- Parking rebuild is deterministic/idempotent. Existing roadside vendor tests
  still pass with the new collision layer.
- Streaming tests exercise removal of parked ECS records on chunk eviction and
  destruction, alongside instance-buffer cleanup and the two-load concurrency cap.
- Road route tests complete multiple laps without teleporting, including the
  bus-only network of roads at least 10m wide.
- Browser checks find exactly four moving buses and four moving kekes among the
  24 traffic entities; both change road positions during sampling. All twelve
  parked ECS snapshots remain unchanged. Both moving models have visible GPU
  instances with finite bounds and share mesh identity with their parked versions.
- Browser page, console and asset-error checks pass. Parking, close bus/keke,
  moving front views and mobile screenshots were visually inspected. The initial
  visual pass found a tricycle seeded on a distant road component; selecting the
  route nearest its local spawn anchor corrected this, and the final run passes.

## Measurement conditions

Hardware: Apple M2, darwin. Headless Chrome 156.0.8078.4.
Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver).

| View | Viewport | Quality | Frame ms | Draw calls |
| --- | --- | --- | ---: | ---: |
| parking | 1440×900 | Auto | 477.6 | 223 |
| bus-rank | 1440×900 | Auto | 498.5 | 223 |
| keke-rank | 1440×900 | Auto | 488.3 | 314 |
| moving-bus | 1440×900 | Auto | 490.7 | 314 |
| moving-keke | 1440×900 | Auto | 447.7 | 249 |
| mobile | 390×844 | Performance | 212.3 | 84 |

These are software-renderer validation measurements, not native Apple GPU
benchmarks. Mobile is viewport/touch emulation, not a physical phone test. Auto
quality changes render scale during the run; exact scale, counts, instance bounds,
model IDs and telemetry are in transport-results.json. No WebP/GPU-block-compression
or KTX2/Basis equivalence is claimed.

Traffic is ambient local simulation with the existing prototype's traffic-rule
and collision-AI limits. Static imported wheels are not individually animated.
No multiplayer traffic authority, vehicle boarding or player driving is added.

## Commands

`node --import tsx scripts/test-transport.mjs`

`node --import tsx scripts/test-streaming.mjs`

`node --import tsx scripts/test-traffic.ts`

`node --import tsx scripts/test-vendors.mjs`

`GAME_TEST_URL=http://127.0.0.1:3100 node scripts/test-transport-browser.mjs`
