# Traffic turning validation

Verified 2026-10-21. The old segment-facing calculation had a maximum 88.224°
instantaneous heading change between adjacent waypoints in the current district.
The route tests now check that each segment's end heading equals the next
segment's start heading modulo 360°, including closed loops, wide-road bus routes
and synthetic dead ends. They also retain multi-lap position/overshoot tests and
check shortest-angle rotation across ±180°.

The browser test executes 2400 deterministic 1/60s update events against the
running game, reading the actual traffic instance matrices. It compares stable
visible instance slots and skips large position changes when culling repacks
slots. It requires turning samples and rejects single-step heading changes of
15° or more. This is a focused regression test, not exhaustive road safety or
collision validation. Route-following and the ambient traffic collision limitations
are unchanged. Instance positions are eased toward authoritative ECS positions;
this adds a small display lag without moving navigation into the render layer.

The screenshot uses a close camera following a visible car, installed only in the
test browser. Both the image and raw results are in `traffic-turns.png` and
`traffic-turns-results.json`. The test's artificially accelerated simulation can
cause the movement-sharing service to disconnect; multiplayer is not under test.

Hardware: Apple M2; headless Chrome 156 with ANGLE/SwiftShader software rendering.
Viewport: 1000 × 700; Performance quality, 65% render scale, sun shadows off.
The JSON records actual renderer, draw calls and frame time. These are software
rendering observations, not native GPU or physical phone benchmarks.

Validation: `node --import tsx scripts/test-traffic.ts`,
`node scripts/test-traffic-turns-browser.mjs`, `npm run lint`,
`npx tsc --noEmit`, and `npm run build` passed.
