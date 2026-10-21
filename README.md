# Eco Active

A playable third-person Lagos Island neighbourhood built with PlayCanvas,
Miniplex and Zustand, hosted by Next.js. Explore a map-aligned Tinubu Square,
Broad Street and Custom Street with other players.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The command starts the web app on port 3000 and the
multiplayer room server on port 3001. Open a second browser to see another player.
Use `?room=my-room` to choose a room; share the same reachable host with friends.
For a phone on your LAN, use your computer's LAN IP instead of localhost.

**Desktop:** WASD/arrows move, mouse drag looks, Shift runs, Space jumps, Escape
pauses. **Touch:** left joystick moves, right side drag looks, Run/Jump buttons.
Use the FPS chip for detailed telemetry. Graphics modes are in the menu.

```bash
npm run lint
npx tsc --noEmit
npm run test:systems
npm run build
npm start
# In another terminal, with the game running:
npm run test:browser
```

For HTTPS deployments, host the WebSocket service behind WSS and set
`NEXT_PUBLIC_MULTIPLAYER_URL` at build time. Rooms support up to 16 connected
players. The current multiplayer prototype shares player movement; ambient
traffic and pedestrians are local, and persistent accounts are not implemented.

The checked-in runtime assets are converted from the supplied Unity project.
Rebuild them with `node scripts/convert-assets.mjs /path/to/template`. Rebuild
map chunks with `npm run world:build`; the OSM extract is already included.
The external Unity folder is never needed to run the game.

See [architecture](docs/architecture.md), [agent rules](AGENTS.md),
[geographic references and accuracy limits](docs/references/README.md),
[asset credits](public/assets/licenses/credits.txt), and
[measured performance](docs/performance/README.md).
