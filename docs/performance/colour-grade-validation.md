# Sunny coastal colour grade verification

Verified 2026-10-21 on Apple M2, headless Chrome 156.0.8078.4 using ANGLE /
SwiftShader software rendering. This is not an Apple GPU or physical-phone
benchmark. Raw GPU identity, viewport, quality, render scale, frame time and
draw calls are recorded in `colour-grade-{before,after,after-mobile}.json`.

The reference informs warmer sunlight, stronger colour separation and deeper
shadows. The existing panorama and authored materials are retained. The first
trial crushed dark road/foliage detail; final HDR contrast is restrained to 1.025,
saturation 1.08, near-neutral tint and 0.12 edge vignette. Ambient fill remains
cool and sunlight is slightly warm. ACES retains highlight rolloff. Fog begins
farther away without extending the camera clip or chunk loading radii.

`CameraFrame` supplies one compose pass and preserves the graphics device's
existing MSAA sample count. Bloom, SSAO, TAA, DoF and volumetric fog are disabled.
The frame is disposed before application destruction. The HUD stays outside
world grading. Both captured viewport sizes were inspected for pavement detail,
shadow readability, fence/sign placement and UI legibility.

Reproduce against a running local web/multiplayer service:

```sh
node scripts/test-colour-grade-browser.mjs after
node scripts/test-colour-grade-browser.mjs after-mobile
```

The desktop capture uses 1440 × 900 / auto quality; mobile emulation uses
390 × 844 / Performance quality (65% scale, no sun shadows). Tests check the
camera compose pass and absence of page errors. The fixed camera is installed
only inside the test browser, never in application code. The baseline was
captured before the implementation with the same camera and desktop viewport.

These are individual HUD telemetry observations, not controlled performance
averages. Software-renderer timings and moving traffic vary; they do not establish
native hardware speed or a performance improvement. `npm run lint`,
`npx tsc --noEmit` and `npm run build` passed on the final implementation.
