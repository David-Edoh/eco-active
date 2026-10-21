# Black vehicle windows

The built-in ImageGen editor was given the original bus and keke UV atlases and
asked to darken only window glass. In-game inspection caught two missed bus
side-glass islands; a targeted second edit corrected them. Generated glass is
retained as transparent editing layers and composited onto the original atlases.
Runtime output remains 1024×1024, with no UV or mesh changes.

Pixel verification reports 74,642 bus glass pixels and 31,382 keke glass pixels
changed, with zero differing decoded pixels outside those masks. Paint, lamps,
mirrors, metal, tires and hubcaps are preserved. Lossless WebP is used to avoid
recompression drift; regeneration through the offline converter was verified.
See docs/references/transport/window-edit-verification.json for hashes and exact
mask regions, and window-edit-prompts.json for the built-in prompt set.

Lint, strict TypeScript and production build pass. Browser checks pass for both
moving and parked vehicles, shared mesh resources and static parked transforms.
Desktop and mobile images were inspected: windshield, rear and side glass are
black, while paint and headlights retain their source appearance. An initial
verification run hit a stopped local WebSocket service; the final run used the
running local service and reports no page, console or asset errors.

Hardware: Apple M2, darwin. Headless Chrome 156.0.8078.4.
Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver).

| View | Viewport | Quality | Frame ms | Draw calls |
| --- | --- | --- | ---: | ---: |
| parking | 1440×900 | Auto | 475.4 | 223 |
| bus-rank | 1440×900 | Auto | 464.8 | 223 |
| keke-rank | 1440×900 | Auto | 445.4 | 314 |
| moving-bus | 1440×900 | Auto | 443.4 | 207 |
| moving-keke | 1440×900 | Auto | 428 | 249 |
| mobile | 390×844 | Performance | 137 | 83 |

These are software-renderer verification samples, not native Apple GPU benchmarks.
Mobile is viewport/touch emulation, not a physical-phone measurement. Full
telemetry and quality render scale are recorded in
transport-black-windows-results.json.

Re-run with:

`node scripts/test-transport-browser.mjs --black-windows`
