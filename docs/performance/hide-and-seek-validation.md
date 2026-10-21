# Adebayo player and Jarvis NPC validation

The two source FBXs and albedo textures from the supplied Hide and Seek project
are converted to local runtime assets. Adebayo is the only local/remote player
model; Jarvis joins the four existing Presido pedestrian models. The NPC roster
and invalid-index fallback exclude Adebayo explicitly.

Validation:

- `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.
- `GAME_TEST_URL=http://127.0.0.1:3100 node scripts/test-presido-browser.mjs --hide-and-seek`
  passes. Actual scene inspection finds Adebayo as the player, Jarvis among nearby
  NPCs, and no Adebayo NPCs. Both imported rigs have finite, changing bone transforms
  in Idle, Walk, Run and Jump. Gallery Jump is sampled at 0.6s and 1.2s within its
  non-looping clip; gameplay still supplies the vertical jump arc.
- `node scripts/test-presido-network.mjs` passes with four concurrent movement
  clients. Arbitrary legacy appearance hints are not replicated; the new client
  fixes remote models to Adebayo.

Desktop screenshots use a temporary stationary lineup for visual rig/material
inspection. The mobile image uses the normal third-person camera in a fresh
390×844 viewport with touch/mobile emulation. Screenshots were inspected for
texture orientation, hair alpha cutout, deformation and attachment.

Hardware: Apple M2/macOS. Browser: headless Chrome 156.0.8078.4, ANGLE Vulkan
SwiftShader software renderer. Auto quality, 1440×900 gallery: 344.5ms/frame,
279 draw calls. Mobile emulation: 586.3ms/frame, 149 draw calls at the recorded
sample. These are software-renderer validation measurements, not native Apple GPU
or physical-phone benchmarks. Exact GPU, roster and telemetry are recorded in
`hide-and-seek-results.json`.

No new dependencies, simulation systems or per-frame UI updates were added.
The twelve-pedestrian population and 45m activation budget are preserved. Source
geometry is indexed without decimation; FBX weights are normalized after the
loader caps skin influences at four. Unity specular/gloss/normal maps and prefab
scripts are not ported. Source paths and provenance are in
`public/assets/licenses/hide-and-seek-characters.json`.

`GAME_TEST_URL=http://127.0.0.1:3100 node scripts/test-presido-multiplayer-browser.mjs --hide-and-seek`
also passes: two browser clients both observe exactly two Adebayo player models.
The roster comparison, peer telemetry and screenshot are saved as
`hide-and-seek-multiplayer-results.json` and `hide-and-seek-multiplayer.png`.
QA networking uses an isolated service on port 3101; the owner's existing running
service is not stopped or modified by the test.
