# Traffic and telemetry validation

Run `node --import tsx scripts/test-traffic.ts` for the real district graph and a
synthetic branching/dead-end route. Both traverse more than two full laps,
checking every half-metre step for discontinuities, including route closure.

With the game running on port 3000, run
`node scripts/test-traffic-browser.mjs`. It checks desktop and mobile-emulated HUD
layout, positive frame-time/draw-call telemetry, stable vehicle identities and
ongoing vehicle movement. Screenshots are `traffic-desktop.png` and
`traffic-mobile.png`; measured hardware, renderer, viewport, quality, frame time
and draw calls are in `traffic-results.json`. These headless measurements are
validation samples, not a representative gameplay or physical-phone benchmark.

Cars follow rounded lane-offset walks of the connected mapped road network.
Dead ends have turning paths; route closure preserves position. Rendering is
limited to the existing 100 m radius, while ECS vehicle identities and navigation
progress persist outside that radius. Traffic is local ambient simulation, not
server-synchronized traffic, and does not implement right-of-way or car collision
avoidance. No additional Unity assets were needed.
