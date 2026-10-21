# Eco Active

A 3D open world game foundation for PlayCanvas with React UI, hosted by Next.js.
Zustand owns React-facing UI state; Miniplex owns core ECS gameplay state.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The current screen is a project shell; PlayCanvas
initialization and gameplay are planned, not yet implemented.

See [architecture and implementation plan](docs/architecture.md) for the canonical
folder structure and [agent instructions](AGENTS.md) before contributing.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Application code lives under `src/`. Next.js uses `src/app/` as its entry;
`src/App.tsx` composes the canvas and React UI. No Vite entry files are needed.
