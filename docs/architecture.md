# Eco Active architecture

Eco Active is an open world game planned around PlayCanvas with React UI.
The existing Next.js App Router is retained as the application host.

## Canonical layout

```text
src/
├── app/                         # Next.js routes, layout, metadata, global CSS
├── assets/
│   ├── models/
│   ├── textures/
│   ├── sounds/
│   └── fonts/
├── components/
│   ├── GameHUD/GameHUD.tsx
│   └── MainMenu/MainMenu.tsx
├── context/GameContext.tsx      # Scoped Zustand instance injection
├── hooks/useGameState.ts        # Selector-based Zustand subscription
├── stores/uiStore.ts            # UI state and actions
├── playcanvas/
│   ├── controllers/
│   │   ├── InputController.ts
│   │   └── SceneController.ts
│   ├── scripts/
│   │   ├── CameraFollow.ts
│   │   └── PlayerMovement.ts
│   ├── ecs/
│   │   ├── components.ts        # Typed gameplay components
│   │   └── createGameWorld.ts    # Per-session Miniplex world factory
│   ├── systems/                 # Movement, AI, physics/render synchronization
│   ├── streaming/               # World chunk lifecycle
│   ├── utils/assetLoader.ts
│   ├── GameBootstrap.ts
│   └── types.d.ts
└── App.tsx                      # Client canvas and UI composition
public/                          # Static URL-served files
docs/                           # Planning and architecture
```

`src/app/layout.tsx` and `src/app/page.tsx` replace the proposed Vite
`main.tsx`. `next-env.d.ts` at the root supplies Next.js environment types;
there is no `vite-env.d.ts`. The `@/` alias resolves to `src/`.

## Boundaries and lifecycle

Routes compose `App`; `App` composes React UI and the state provider.
Future engine initialization belongs in a client effect that passes the canvas
into `GameBootstrap` and returns cleanup. The bootstrap owns engine setup and
teardown, controllers coordinate systems, and scripts implement entity behavior.
Engine code remains independent of React. Typed events/callbacks expose coarse
state projections to Zustand; simulation and per-frame gameplay state stay in
Miniplex, with PlayCanvas responsible for physics execution and rendering.

Imported/source asset files live under `src/assets/`. URL-loaded runtime assets
live under `public/assets/{models,textures,sounds,fonts}/` as needed and resolve
from `/assets/...`. Empty asset directories are retained by `.gitkeep` files.

## Implementation plan

1. Foundation (current): folders, React shell, scoped Zustand UI store, Miniplex world factory,
   selector-based UI hook, and mandatory agent rules.
2. Implement PlayCanvas bootstrap initialization, resize, cleanup,
   and a minimal scene. Verify rendering and remount behavior in a browser.
3. Implement input, scene orchestration, asset loading, player movement, and
   camera follow using APIs supported by the installed PlayCanvas version.
4. Bridge loading, playing, paused, and error states into React; add working
   menu controls and HUD as those systems become available.

PlayCanvas, Zustand, and Miniplex are installed. The UI store and empty ECS world factory are
implemented; the bootstrap, controllers, scripts, and asset loader remain explicit
placeholders. Systems and streaming currently contain planning notes only.
Engine initialization, rendering, asset loading, input, and gameplay are not yet implemented.
Changes to this layout must include an explanation and corresponding updates to
this document and `AGENTS.md`.

## State ownership and data flow

Miniplex owns authoritative players, NPCs, vehicles, traffic, world entities,
physics-related gameplay data, and gameplay inventories. `GameEntity` starts with
optional marker/position/velocity/chunk components; add concrete components only
when a feature needs them. `createGameWorld()` creates isolated session worlds.

Zustand owns HUD display snapshots, inventory UI, menus, notifications, and
settings. The initial store provides status and inventory/settings visibility;
HUD values, item projections, and notifications will be added with their features.
`GameProvider` creates one vanilla store per mount, and Context only injects that
instance. `useGameState(selector)` subscribes React to individual UI values.
This replaces the former Context-owned state without a global server-side store.

The intended bridge is wired by the client composition layer: engine events →
plain display snapshots → Zustand actions → React selectors. UI gameplay intents
travel through typed engine commands and system validation. Engine modules must
not import Zustand or React. Do not expose live ECS or engine objects in UI state.
Publish changes or throttled snapshots rather than mirroring the world each frame.
Bridge callbacks, engine commands, and runtime systems are still planned.

GameBootstrap will create and own the world, system schedule, and streaming
lifecycle. Streaming tracks chunk membership, removes entities and associated
PlayCanvas resources on unload, and cancels pending work during teardown.

API references: [Zustand](https://zustand.docs.pmnd.rs/) and
[Miniplex](https://github.com/hmans/miniplex).
