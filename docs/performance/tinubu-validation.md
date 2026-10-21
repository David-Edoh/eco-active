# Tinubu Square visual validation

Host: Apple M2. Headless Chrome uses ANGLE/SwiftShader software rendering.
Mobile uses viewport/touch emulation, not a physical phone. These telemetry
snapshots do not establish native GPU performance or a before/after improvement.

| View | Viewport | Quality | Frame time (ms) | Draw calls |
| --- | --- | --- | ---: | ---: |
| front | 1440 × 900 | auto | 381.8 | 229 |
| reverse | 1440 × 900 | auto | 322.7 | 229 |
| overhead | 1440 × 900 | auto | 319.1 | 230 |
| mobile | 390 × 844 | performance | 136.4 | 110 |

All four views loaded the local monument with eleven material groups and no
page/network errors. Screenshots were inspected from front, reverse and above,
and in mobile emulation. Jets are static geometry. Surrounding stock facades,
figurative statues and mature vegetation remain fidelity limitations.

`npm run lint`, `npx tsc --noEmit`, and `npm run build` passed.

Connected-basin correction: repeated all four views after joining the three
circular pools and clearing overlapping ferns. No page/network errors.

Enlarged/centered pad: repeated all four browser views, with no page/network
errors. Lint, strict TypeScript and production build passed.
