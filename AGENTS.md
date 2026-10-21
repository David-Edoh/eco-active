<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Eco Active: mandatory project structure

Eco Active is a TypeScript, React, Next.js application with a planned PlayCanvas
runtime. Read `docs/architecture.md` before changing application code.

- All application code MUST live in `src/`. Keep configuration, dependencies,
  `public/`, and project documentation at the repository root.
- `src/app/` owns Next.js routing, metadata, global styles, and route composition
  only. Do not put gameplay, engine initialization, or reusable UI in routes.
- `src/App.tsx` composes the game canvas, provider, and UI. Next.js owns the entry
  point; do not add `main.tsx`, `vite-env.d.ts`, Vite configuration, or a second
  root `app/` or `pages/` directory without an explicitly requested migration.
- `src/components/<PascalCaseName>/<PascalCaseName>.tsx` owns global React UI.
  Keep component-specific styles and supporting files beside their component.
- `src/stores/` owns Zustand UI store factories and UI types. `src/context/`
  injects per-provider store instances only; it MUST NOT duplicate reactive state.
  `src/hooks/` owns selector-based React hooks named `use<Name>.ts`.
- `src/playcanvas/` owns ALL engine-specific code and PlayCanvas imports:
  `controllers/` for system orchestration, `scripts/` for entity behaviors,
  `utils/` for engine helpers, `GameBootstrap.ts` for application lifecycle,
  and `types.d.ts` for necessary scoped engine type augmentations.
- Engine modules MUST NOT import React, Next.js, UI components, contexts, hooks, or Zustand stores.
  Bridge engine events through typed callbacks or subscriptions. Do not update
  React state every frame. Avoid circular dependencies.
- Initialize browser/engine APIs only after client mount, never during module
  evaluation or server rendering. Destroy the application and remove listeners,
  subscriptions, timers, and resize handlers on cleanup; tolerate remounts.
- `src/assets/{models,textures,sounds,fonts}/` holds source/imported assets.
  Files loaded by URL at runtime belong in matching `public/assets/` subfolders.
  Do not duplicate assets in both trees; document where each runtime asset lives.
- Use PascalCase for components, classes, and entity script filenames; camelCase
  for utility modules and hooks. Use `@/` for cross-folder source imports and
  relative imports within a feature. Prefer explicit named exports except where
  the framework requires a default export or for `App.tsx`.
- Do not create alternative catch-all folders (`lib`, `helpers`, `common`,
  `misc`) or duplicate existing responsibilities. New top-level source folders,
  renames, moves, and architecture changes MUST update `docs/architecture.md`
  and these rules in the same change, with a concrete rationale.
- Keep TypeScript strict. Do not use `any`, suppress type errors, or add global
  declarations to bypass missing implementation. Use the installed engine's
  documented, version-appropriate script APIs rather than assuming legacy
  `pc.createScript` support.
- Planned modules are explicitly labeled placeholders. Do not present them as
  functional systems. PlayCanvas, Miniplex, and Zustand are installed; keep
  package.json and the lockfile synchronized when changing dependencies.
  Do not introduce speculative dependencies.
- Before finishing, run `npm run lint` and `npx tsc --noEmit`; run the build when
  routing, dependencies, or runtime integration changes. Report failures and
  environmental limitations honestly. Preserve unrelated user changes.

## Mandatory state ownership

- Miniplex is the source of truth for core gameplay: players, NPCs, vehicles,
  traffic, world entities, and physics-related gameplay components. Define typed
  entity components in `src/playcanvas/ecs/`; create a world per game session.
  Never create a mutable global ECS world or share one between server requests.
- Zustand owns React-facing HUD snapshots, inventory displays, menus,
  notifications, and settings in `src/stores/`. Create a store per provider;
  do not read or mutate UI stores in Server Components. Use narrow selectors;
  selectors returning new objects/arrays require stable references or shallow
  equality handling. Do not subscribe UI components to the entire store.
- UI snapshots MUST contain plain display data, never live ECS entities,
  PlayCanvas entities, physics bodies, or mutable engine objects. Gameplay
  inventory, health, position, and simulation remain authoritative in the ECS;
  UI copies are projections, not competing sources of truth.
- The client composition layer wires typed engine callbacks into Zustand
  actions. UI gameplay commands must pass through a typed engine command API,
  where systems validate them; changing a UI value must not mutate gameplay.
  Publish meaningful changes or deliberately throttled HUD snapshots, never the
  full world every frame. Dispose bridge subscriptions on teardown.
- `src/playcanvas/systems/` owns movement, AI, physics synchronization, and
  rendering synchronization. Controllers orchestrate services; entity scripts
  adapt PlayCanvas lifecycle. Do not duplicate simulation across these layers.
  PlayCanvas runs physical simulation and renders; define one explicit direction
  of synchronization for each transform/body component to prevent competing writes.
- `src/playcanvas/streaming/` owns chunk lifecycle. Track entity chunk ownership
  and clean up ECS entities, scene objects, physics bodies, pending asynchronous
  loads, and assets on unload or session destruction.
- Do not introduce another state library, React ECS bindings, or persistence
  middleware without a concrete feature requirement. Keep stores and ECS
  factories usable independently for validation.

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->

## Playable district rules

- `src/playcanvas/world/` owns authored geographic content and custom landmarks.
  Map-derived content lives in `public/assets/world/`; preserve its OSM IDs,
  source extract, projection, and attribution. Do not describe inferred heights,
  generic facades or the interpreted monument as an exact surveyed replica.
- `src/server/` owns the multiplayer service and must never enter a client bundle.
  Validate all inbound messages, bound room size/payload/rate, use WSS for HTTPS
  deployments, and document which state is authoritative or merely replicated.
- Root `scripts/` is reserved for offline asset/map conversion, process launch,
  and verification tools. Runtime source stays in `src/`. Three.js is an offline
  converter dependency only; all browser 3D rendering uses PlayCanvas.
- Reuse the supplied Unity geometry for ordinary buildings, roads, vehicles,
  foliage and people. Copy/convert required files into this repository. Runtime
  URLs must never point at the external Unity project. Preserve source notices.
  Custom primitives are limited to landmarks absent from the supplied pack.
  Street accessories must use pre-modelled assets from the supplied Unity project;
  do not create custom lamps, art panels, or reconstructed primitive furniture.
- Keep shared geometry/materials in the session asset library. Instance repeated
  meshes per geographic chunk, compute valid bounds, cap concurrent chunk loads,
  and release instance buffers on eviction. Do not build the whole city at once.
- Bake ambient shading offline, cap texture sizes, avoid blended transparency,
  and keep shadows local. WebP transfer compression is not GPU block compression;
  never claim KTX2/Basis support until it is implemented and tested.
- New AI or physics must obey distance-based simulation budgets. Keep the update
  loop allocation-light and publish UI telemetry no more than twice per second.
- For rendering/control/network changes, run browser tests and inspect screenshots.
  Record hardware, viewport, quality, frame time and draw calls. Distinguish mobile
  emulation from measurements on a physical phone. Never fabricate benchmark data.
- The UI uses ordinary global CSS. Do not restore the obsolete Tailwind Turbopack
  loader solely to style components. Use the installed Next.js CSS documentation.
