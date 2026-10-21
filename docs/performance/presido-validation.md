# Presido character validation

All four supplied human models replace the previous runtime civilian model for
local players, network peers and ambient pedestrians. Original albedo atlases are
preserved with their FBX UV orientation. Independent accessory skeletons receive
matching baked tracks; original meshes are not replaced with recoloured stand-ins.

`node scripts/test-presido-browser.mjs` validates finite, changing bone transforms
for Idle, Walk, Run and Jump on all four models and records a front-view lineup.
Jump is deliberately sampled at 0.6s and 1.2s in the non-looping clip; the gameplay
controller supplies the actual vertical jump arc. Gallery screenshots hold models
in place and do not measure gameplay movement or foot locking.

Measured on Apple M2/macOS, headless Chrome 156, ANGLE SwiftShader software Vulkan
renderer, Auto quality, 1440×900: the final gallery sample reports 315.4ms/frame
and 289 draw calls. These software-renderer figures are a validation artifact,
not an Apple GPU or physical-phone performance benchmark. Mobile screenshot uses
a fresh 390×844 viewport with touch/mobile emulation and the normal third-person
camera. This remains emulation rather than a physical device measurement. Exact measurements and GPU string are saved in
`presido-results.json`; screenshots were visually inspected for texture placement,
rig deformation, accessory attachment and roster appearance.

`node scripts/test-presido-network.mjs` verifies four concurrent clients replicate
roster IDs 0–3 and an out-of-range ID is rejected. The test uses an isolated updated
room service on port 3101; it does not change the owner's existing service.

Lint, strict TypeScript checking and the production build pass. Existing unrelated
working-tree changes are preserved.

`node scripts/test-presido-multiplayer-browser.mjs` also passes with two actual
browser clients. Both clients observed the identical Bola Tinubu / Indaboski roster
pair in that run. `presido-multiplayer-results.json` records both peer counts,
appearances and telemetry; `presido-multiplayer.png` captures the scene.
