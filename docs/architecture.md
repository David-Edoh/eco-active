# Eco Active architecture

Eco Active runs a PlayCanvas third-person neighbourhood inside a Next.js/React
shell. Miniplex owns live game entities; Zustand owns UI state and telemetry.
The first playable district is a roughly 360 m square around Tinubu Square,
Broad Street and Custom Street on Lagos Island.

## Canonical layout

```text
src/
├── app/                         # Route, metadata, viewport and global CSS
├── assets/                      # Reserved for imported source assets
├── components/
│   ├── GameHUD/                 # Location, connection status and player overlay
│   ├── MainMenu/                # Loading, entry, pause and quality selection
│   ├── MiniMap/                 # Read-only projection of the local OSM geometry
│   ├── PerformancePanel/       # Half-second telemetry snapshots
│   └── TouchControls/           # Joystick, look, run and jump input
├── context/GameContext.tsx      # Per-provider Zustand instance injection
├── hooks/useGameState.ts        # Narrow selector subscriptions
├── stores/uiStore.ts            # UI state/actions; no mutable engine entities
├── playcanvas/
│   ├── controllers/            # Input, WebSocket networking; scene slot reserved
│   ├── ecs/                    # Miniplex entity types and world factory
│   ├── scripts/                # Player movement and third-person camera
│   ├── systems/                # Animation, traffic, pedestrians, resolution
│   ├── streaming/              # Async chunk loading, instancing and eviction
│   ├── utils/assetLoader.ts     # GLB/texture lifetime and shared materials
│   ├── world/createLandmark.ts # Custom Tinubu Square monument
│   ├── types.ts                # Plain bridge, map and transport contracts
│   ├── types.d.ts              # Reserved for required engine augmentations
│   └── GameBootstrap.ts        # Session lifecycle, update loop and composition
├── server/multiplayer.mjs       # Bounded WebSocket room service
└── App.tsx                     # Client effect and typed engine/UI wiring
public/assets/
├── models/                     # Converted local GLBs, including the Unity fern
├── textures/                   # Local WebP images, maximum 1024 px
├── world/                      # District manifest and 64 m chunk JSON files
└── licenses/                   # Original notices, credits and conversion manifest
scripts/                        # Offline conversion, map build, launch and QA tools
docs/                           # Architecture, provenance and measured performance
```

`src/app/` is the entry point. `@/` resolves to `src/`. `world/` was introduced
for authored geographic content; `server/` hosts the long-lived room service,
which must not be imported into the browser. `scripts/` contains tooling only.
No Vite entry, second router, global engine singleton, or React ECS binding exists.

## Runtime and ownership

`App` dynamically imports the engine after mount, creates it against the canvas,
subscribes UI status/quality actions, and destroys it on unmount. Context injects
a vanilla Zustand store per provider. The engine emits plain progress/error
messages and a performance snapshot twice per second. React never runs simulation.

`GameBootstrap` creates a Miniplex world per session. Local/remote players,
vehicles and pedestrians live in that world. Rendering handles stay in the engine
layer. Local movement is a lightweight kinematic controller with gravity, jump,
sliding footprint collision and a bounded map; it does not use Ammo or a full
rigid-body simulation. The camera shortens its orbit near obstacles. Character idle/walk/run/jump use the supplied StarterAssets FBX animation clips,
retargeted offline onto the supplied character rig. The converter reads Unity's
calibrated humanoid reference pose from `Armature.fbx.meta`, rather than treating
the FBX default pose as the avatar reference. Clips were initially baked into
`public/assets/models/character.glb`, now an offline reference for the four Presido
models described below; no Unity files are needed at runtime.
PlayCanvas crossfades only when gameplay changes state; only START → Idle is an
automatic graph transition. Horizontal root motion and jump root translation are
removed so movement remains authoritative in `PlayerMovement`. Grounded clips
retain hip bob. Regenerate just the character with
`node scripts/convert-assets.mjs <Unity-template-directory> --character-only`.
See `docs/references/character-animation.md` for clip provenance and validation.

`InputController` owns keyboard, mouse-drag and input cleanup. TouchControls
writes only input intents through the engine's input boundary. Escape pauses
local movement while network peers continue. All subscriptions and browser
listeners have explicit teardown.

## Streaming and rendering

The offline map build converts WGS84 coordinates to local metres (north = -Z),
fits the three supplied building models and two photo-informed landmark models to mapped oriented footprints, and writes
independently fetched 64 m chunks. Only chunks within the current radius are
requested, with two in-flight requests; a larger eviction radius avoids churn.
Aborted/late responses cannot create chunks after destruction.

Roads use offline map-fitted surface meshes: union width-aware segment footprints
and shared-node mouth joins before subtracting asphalt from pavement. This removes
slab gaps and pavement across T/angled junctions. Clip the resulting polygons,
including holes, into 64 m chunks; the streamer uploads their positions/normals
into PlayCanvas meshes and destroys those meshes on eviction. Shared Unity-derived
road/paving materials stay in the session library. Source City FBX lives in
`src/assets/models/roads/`; no external asset path is used at runtime.

Each chunk groups repeated geometry by model/material. Each group shares a static
instance matrix buffer; bounds are computed from the transformed meshes for
frustum culling. Unload destroys chunk entities and instance buffers. The small
shared model/texture library remains cached for the session, so moving back into
a chunk does not download duplicate geometry. This is placement/instance streaming,
not independent unloading of every shared texture.

Building materials retain the supplied wall, masonry, trim and window slots; seven
shared streetscape palettes distinguish the ordinary buildings. The converter ray-bakes local
ambient occlusion into vertex colors (12 hemisphere rays per vertex). This is
baked ambient shading, not a full scene lightmap. One limited-range sun provides
live shadows. Surface textures use metre-scaled world UVs; the fern uses alpha
cutout without blended transparency. Model textures are WebP compressed for
transfer; GPU block compression/KTX2 is not yet implemented.

Traffic uses shared GPU instance buffers. Nearby cars update every frame; distant
cars update at 5 Hz and are culled beyond 100 m. Pedestrians are instantiated and
simulated only within 45 m. Traffic follows continuous closed walks over connected mapped roads, with lane
offsets and rounded junction/dead-end turns. Waypoint progress lives in the ECS;
cars retain their positions outside the render radius. Traffic remains ambient
local simulation without traffic lights, right-of-way or vehicle collision AI. Auto quality
adjusts resolution every three seconds with hysteresis. Performance quality
uses 65% render scale, an 85 m chunk radius and disables sun shadows.

## Multiplayer

`npm run dev` and `npm start` launch the web app and a WebSocket server on port
3001. Clients join `?room=NAME` (default `tinubu`), with a maximum of 16 players per
room. Movement sends and broadcasts run at 20 Hz; remote avatars interpolate.
The server validates finite coordinates, world bounds, movement rate, payload
size and message frequency, and removes stale/disconnected sockets. Rooms are
isolated. Reconnect retains local exploration and restores a session connection.

This is a lightweight movement-sharing prototype: the client controls movement;
the server is not an authoritative physics/anti-cheat simulation. Traffic/NPCs
are local ambient simulation and are not synchronized between clients. There
are no accounts, saved worlds or public matchmaking services.

For HTTPS hosting, run the room server behind a WSS reverse proxy and set
`NEXT_PUBLIC_MULTIPLAYER_URL` at build time. Both devices must reach the same web
and WebSocket host. A localhost link only works on the host computer.

## Geographic fidelity

See `docs/references/README.md`. The road centerlines, park boundary, building
positions and available heights come from OSM. Unmapped heights and generic
supplied facades are approximations. The custom fountain, tapered portals and three birds are a multi-view
photo-informed reconstruction, not surveyed landmark geometry. See
`docs/references/tinubu/research.md` for evidence, omissions and date limitations.
An exact present-day replica requires matching facades, vegetation and field
measurements that the supplied pack does not contain.

## Validation

`npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:browser` and
`npm run test:systems`. Browser tests use installed Chrome and a running game.
Read the run-specific `docs/performance/*-validation.md` files for measurement
conditions and limits.

## Atmosphere and ambient population

Neutral daylight, blue ambient fill and cool fog/material tints replace the warm
sun/beige cast. The supplied City `Afternoon_Skybox.hdr` is converted offline to a
1024 × 512 RGBE panorama in `public/assets/textures/afternoon-sky.hdr`. The session
library creates a 256px-face sky cubemap and destroys it on teardown. The template
photographic horizon is scenery, not a geographically accurate Lagos skyline.

`node scripts/convert-atmosphere-assets.mjs <Unity-template-directory>` converts
the supplied PioneerSW80 station wagon and Phoenix445 sports car into local GLBs.
Source paths and notices live in `public/assets/licenses/atmosphere-assets.json`,
`sports.txt`, and the existing template notices. The wagon folder has no separate
license file in the supplied source. No runtime asset
requires access to the Unity project. Moving traffic retains a total budget of 24: six sedans, six wagons, four sports
cars, four supplied buses and four supplied kekes, with one shared GPU instance
buffer per model; the existing 55/100m update/render
budgets remain in effect. Twelve pedestrians cycle through the four supplied Presido character meshes plus Jarvis,
retaining their original albedo atlases, retargeted animations and 45m activation
limit. Geometry, textures and animation assets are shared per roster model. All gameplay positions remain in the session ECS.

## Sealed ground and vehicle facing

`world/createGround.ts` reuses the supplied Unity street slab's two top triangles,
rectifies its tapered corners to a rectangle, and fits them beneath the district
at y = 0m. It spans the movement bounds plus the view distance and 2m on each side (beyond the
340m camera far clip), covering gaps between the original curb tiles and areas
whose detailed chunks are loading or evicted. It costs two triangles and one
draw call, shares the ground material, and destroys its derived mesh on teardown.
The streamer skips the old tapered ground tiles; roads and pavement keep their
existing layers above this sealed base.
The source slab and its material remain local assets; no replacement primitive
or second ground simulation is introduced.

Dry floor materials disable skybox reflection and specular response explicitly.
The unfiltered display cubemap remains available to the sky and other materials.
Vehicle facing uses a model-specific offset: the converted sedan faces local -Z,
while the wagon and sports car face local +Z. Navigation yaw remains authoritative;
only the instance render rotation receives the asset-facing correction.

## Researched building placement

See `docs/references/buildings/research.md` for the dated views, matching decisions,
source-pack audit, limitations and reproduction commands. Ordinary buildings use
all three supplied variants and four low-rise derivatives selected by height/type, rather than by OSM-ID modulo.
Original facade material slots are preserved. One- to four-storey derivatives
remove complete floor bands from the supplied commercial mesh and retain its
source roof, so short mapped buildings do not compress five storeys into one. `building-catalog.json` shares model
bounds and profile definitions between the offline builder and engine library.
`WorldItem.profile` selects cached session materials; instance groups include that
profile in their key. No per-building duplicated geometry/material library exists.

Two absent landmarks (Trinity Church and CBN Lagos) have small custom offline GLBs
using local supplied materials. The full map placement audit records source IDs,
footprints, evidence, confidence and the difference between measured/mapped and
estimated heights. Inferred landmark associations and generic facades are not
claimed to be exact surveyed replicas. Source City FBX stays in its existing local
source location; runtime assets live only in `public/assets/`.

Five mapped tall buildings are excluded from ordinary chunks and kept in one
session skyline group by ChunkStreamer, with explicit buffer/entity teardown.
Normal buildings still stream by distance. `world/viewSettings.ts` shares the
340m view distance with camera and sealed ground sizing. All 132 building records
remain in the collision district; only their render residency differs. Source
positions use the centre of each oriented footprint's bounds rather than the
vertex average, so irregular sampling does not displace the fitted model.


## Tinubu decoration geometry

`node scripts/build-tinubu-monument.mjs` generates the local custom fountain GLB
with eleven merged material groups, stone vertex colors, feathered birds,
extruded lettering and static jet arcs. Three.js and local licensed font data
are offline inputs only. AssetLibrary owns the session container; createLandmark
owns its instance, paved park mesh and batched fence/garden decoration. Teardown
removes the batch and entities before unloading session assets. No per-frame
water simulation, UI state or engine listener is added. Detailed provenance and
remaining fidelity limits are recorded in `docs/references/tinubu/research.md`.

The fountain basin uses an offline polygon union of one large and two small
circles with connecting necks; water, coping and walls share that continuous
outline. The aerial-reference correction is documented in the Tinubu research.

The complete connected pad is scaled 1.15 in X/Z, retaining its height, and
centered by its complete footprint bounds on the mapped park centroid. Offline
planting exclusions share the transformed main/satellite basin coordinates.

## District edge coverage

ChunkStreamer maintains a separate distance-bounded building backdrop in 64m
cells. Mapped ordinary buildings use low-rise derivatives of the supplied Unity
geometry scaled to their existing footprint and height; Trinity retains its
landmark model. These display stand-ins are hidden whenever the matching detailed
chunk is loaded and reappear on eviction. The collision/ECS map and authoritative
footprints do not change. Five mapped skyline landmarks retain their existing
session residency.

An explicitly fictional two-row city backdrop at 264/300m around the district
closes views beyond the finite map. It reuses the local supplied two-floor model,
not custom primitive buildings or external Unity URLs. These placements are
scenery, not additional surveyed Lagos buildings, navigation or collision areas.
Offline definitions live in build-world.py and District.distant in district.json.

Distant cells are built nearest-first, at most two per streaming update, use
shared session meshes/materials, valid instance bounds and frustum culling, and
cast no sun shadows. Cells beyond the camera range plus a cell margin are released
with hysteresis. Destruction releases all backdrop instance buffers and entities.
Detailed requests are capped at two during warm-up and normal streaming. Quality
settings retain distant coverage when reducing the detailed loading radius.

Initial preparation builds the bounded visible backdrop behind the loading
screen using shared meshes/materials; subsequent movement adds at most two cells
per streaming update. RenderComponent clears incoming mesh custom bounds, so the streamer
assigns per-mesh instance bounds after attaching the component. Culling then uses
the transformed group extents rather than the uninstanced source-mesh bounds.


## Street asset policy

Street accessories must use pre-modelled assets from the supplied Unity project.
The experimental street dressing pass has been removed, including its chairs,
custom lamps, art panels and additional roadside fern placements. Existing
Unity-derived district scenery and landmark work remain unchanged. Do not
reconstruct primitive prefabs or create custom accessory geometry as substitutes
for suitable pre-modelled assets.

## Illuminated windows

The supplied Unity City `BuildingWindows.mat` enables emission using the same
BuildingWindows02 atlas as its albedo, with white emission colour. AssetLibrary
now reproduces that setup for WindowAtlas and the supplied sash-window slot,
using their existing local windows/window textures and UVs. Shared building
profile materials inherit emission independently of their diffuse tint, including
streamed, distant and skyline instances. No extra geometry, point lights, texture
downloads, frame updates or postprocessing are added. This is a self-lit material,
not interior geometry or light spilling onto the street.

## Character roles and roster

`PLAYER_CHARACTER_MODEL` is always `character-adebayo` for the local player and
all remote players. `NPC_CHARACTER_MODELS` contains only Ratel Presido, Peter Obi,
Indaboski Bahose, Bola Tinubu and Jarvis (spelled Jarvis in the Hide and Seek project).
Adebayo is deliberately absent from that list. PedestrianSystem cycles twelve
NPCs across the five entries, retaining the 45m activation budget. Its model and
animation lookup both use `AssetLibrary.pedestrianModel`; the NPC instantiation
path cannot select Adebayo, including its invalid-index fallback.

Player appearance no longer has a random roster index or a client-selected
network field. Both local and remote composition use the same fixed Adebayo asset.
The service continues to validate movement and ignores extra appearance hints;
NPC choices are never used to construct a remote player. Players are broadcast
after their first validated pose. Restart the web app and multiplayer service
after updating; gameplay authority is unchanged.

All six characters retain original skinned geometry and local albedo atlases,
capped at 1024px. Session assets/materials are shared. Adebayo preserves separate
body/hair material groups; hair uses alpha cutout at 0.5 with the source atlas,
not blended transparency. FBX skin weights are normalized after the loader limits
influences to four, and identical vertices are indexed offline without reducing
the supplied mesh's triangle count. This is not a low-poly LOD or mesh decimation.

`node scripts/convert-presido-characters.mjs <presido-project>` produces the four
Presido GLBs/textures. The same converter with
`<hide-and-seek-project> --hide-and-seek` produces Jarvis and Adebayo. It retargets
the existing locally baked StarterAssets animation deltas at 30 Hz onto each
source skeleton. Adebayo's Mixamo bone prefixes are normalized; accessory skeletons
keep unique names. Grounded clips keep hip bob; jump and horizontal root movement
remain owned by PlayerMovement. The legacy `character.glb` is only an offline
animation reference and is never fetched by the game. Source FBXs are not duplicated
into src/assets; runtime files live in public/assets/models and textures.

Source paths, heights and conversion details live in
`public/assets/licenses/presido-characters.json` and
`hide-and-seek-characters.json`. The supplied Presido third-party notice and
Hide and Seek Platformer Project README are preserved beside the manifests.
No separate character-specific license was found beside the two new source assets.

## Roadside commerce

The six supplied Hide and Seek stall meshes are converted by
`scripts/convert-vendor-assets.mjs` into `public/assets/models/vendor-*.glb`, with
matching capped albedo WebPs and offline eight-ray vertex ambient shading. Mesh
parts are merged per original albedo atlas, grounded and normalized to estimated
street-stall dimensions. Unity texture assignments are resolved through importer
GUIDs, not filenames guessed from similarly named atlases. No custom umbrella,
shop or street furniture geometry is substituted. `vendor-catalog.json` records
bounds and provenance; source FBXs are not duplicated into src/assets.

`scripts/build-vendor-placements.mjs` adds an idempotent authored commerce layer to
the existing district/chunks. It runs after road generation in build-world.py.
Two supplied photographs inform regional density: 31 stalls in the Custom Street,
church/Broad Street and Alli junction approaches, and four scattered on quieter
outer park edges. Candidate placements along the narrow northern storefronts are
rejected where they conflict with mapped buildings/road clearance. Individual
vendor locations, dimensions and attendance are interpreted scenery, not OSM
features or a surveyed/current vendor census. The park interior stays clear.
See `docs/references/vendors/research.md` and `placement-audit.json`.

`WorldItem.kind = vendor` uses the normal geographic chunk lifecycle, cached
session geometry/materials, static per-model instance buffers and transformed
culling bounds. Chunk eviction destroys stall buffers/entities; destruction
unloads the session assets. Stalls do not get distant building proxies, extra
lights or live shadows. `District.stalls` is an authored static collision layer
consumed by the existing player/camera collision grid alongside building bounds;
road lanes, park interior, existing buildings, spawn and stall neighbours are
excluded offline. Stall sizes include the canopy's conservative footprint.

Six of the existing twelve NPCs become stationary stall attendants. Their
`vendor.stallId`, position and yaw live in the per-session Miniplex world.
PedestrianSystem alone orchestrates their idle animation and 45m activation;
models are destroyed outside that radius, and all ECS NPC records are removed on
session destruction. They remain bounded session NPCs, not additional chunk-owned
population. The other six pedestrians keep their walking behavior. All NPCs use
the five-model NPC roster; Adebayo remains player-only. No shop transactions,
inventory, additional UI state or per-frame telemetry are introduced.

## Moving and parked buses/kekes

`node scripts/convert-vendor-assets.mjs <hide-and-seek-project> --vehicles` reuses
the existing offline static conversion pipeline for bus.fbx and keke.fbx, preserving
their albedo atlases and baking local vertex ambient shading. Runtime assets are
`public/assets/models/{bus,keke}.glb` and matching capped WebP textures; source
paths and estimated dimensions are in `world/transport-catalog.json` and
`licenses/transport-assets.json`. No source FBX, Unity project URL, or Unity script
is loaded by the browser. The bus is a supplied compact minibus proxy, not an
exact surveyed Danfo vehicle specification.

TrafficSystem keeps 24 moving ECS vehicles across five configurable batches. Buses
use connected routes built from roads at least 10m wide; kekes use the existing
7m minimum road network. Four of each are seeded along local road approaches.
Near vehicles update every frame, distant ones at 5Hz; render culling stays at
100m. Instance buffers are sized once per batch, and bounds use actual model
radii/heights. Position/yaw flow from route navigation in the ECS to instance
matrices; no extra UI updates or physics solver is added. Ambient traffic remains
local to each client and retains the prototype's existing collision/traffic-rule
limitations; it is not an authoritative multiplayer traffic simulation.

`scripts/build-transport-parking.mjs` places coherent motor-park ranks after the
stall layer. Twelve parked vehicles form three authored groups: four buses and
five kekes at the Custom Street commercial approach, plus three kekes near Alli
Street. These are an interpretation of the requested clustered parking pattern,
not surveyed/legal parking bays or a present-day transport census. The offline
solver rejects road corridors, park interiors, buildings, stall access/attendants,
spawn and other parked bodies. Shared offline geometry utilities live in
`scripts/worldPlacementGeometry.mjs`; runtime geometry logic stays in src.

`WorldItem.kind = parkedVehicle` uses geographic chunk instancing with the same
loaded mesh/material resources as moving vehicles. ChunkStreamer now receives the
per-session ECS world: each parked vehicle gets a vehicle/parked/model record,
position, yaw and chunkId when its detailed chunk loads. Those ECS transforms
produce the static GPU instances. Chunk eviction removes ECS records and destroys
instance buffers; destruction also covers pending loads and remaining records.
Parked vehicles never receive moving navigation or distant building proxies.
`District.parkedVehicles` supplies immutable authored collision footprints to the
existing player/camera/pedestrian collision grid, including while distant chunks
are unloaded. No driving, boarding or parking-edit command is introduced.

Optional diagnostics publish plain model IDs with moving traffic and parked ECS
snapshots at the existing half-second cadence. See
`docs/references/transport/research.md` and `docs/performance/transport-validation.md`
for provenance, reproduction and measured verification conditions.

### Vehicle window texture edits

Bus/keke windows use built-in ImageGen edits of their existing UV atlases. Only
glass regions are retained as transparent source overlays in
`src/assets/textures/transport-window-edits/{bus,keke}.png`; these are editing
layers, not duplicated complete runtime textures. The converter first reproduces
the original 1024px WebP atlas, applies that overlay, and writes the complete
runtime `public/assets/textures/{bus,keke}.webp` losslessly so non-window pixels
remain identical. Yellow paint, stripes, lamps, mirrors, wheel hubs, geometry and
UV layout are preserved. Both parked and moving instances use the shared result.

Regenerating vehicle assets with `--vehicles` reapplies the checked-in overlays.
The exact built-in prompts, saved asset paths and pixel comparison are recorded
in `docs/references/transport/window-edit-prompts.json` and
`window-edit-verification.json`. No image generation service or source overlay
file is needed by the running game.

## Sunny coastal colour grade

`GameBootstrap` balances warm direct sunlight with restrained cool ambient fill.
The session camera uses the installed PlayCanvas `CameraFrame` HDR compose pass:
ACES tone mapping, modest saturation/contrast, a near-neutral tint and subtle
edge vignette. The React HUD is outside this grade. Bloom, SSAO, depth of field,
TAA and volumetric fog stay disabled; this adds one fullscreen compose draw,
not extra scene lights or per-frame UI state. CameraFrame owns its render targets
and is destroyed before application teardown. Existing resolution/quality controls
continue to set canvas size and local sun shadows. The distance fog starts at
145m and ends at 330m, within the 340m camera clip, keeping nearby streets clearer
while retaining the streamed district's horizon fade.

The supplied afternoon HDR panorama and all original asset textures remain in use.
The racing screenshot informs colour and light balance, not replacement geometry
or an exact match to its sky/art assets. See `docs/performance/colour-grade-validation.md`
for captured views, software-renderer limitations and reproduction commands.

## Continuous traffic facing

`trafficRoutes.trafficHeading` interpolates the bisected incoming/outgoing
headings at each route vertex using shortest-angle differences. The outgoing
heading of one segment equals the incoming heading of the next, including the
closed-route seam; cars no longer snap to a different segment heading on arrival.
Route distances and ECS navigation/positions keep their existing authority.
`TrafficBatch` keeps presentation-only position/yaw scalars and eases instance
transforms toward ECS poses with a frame-rate-independent exponential response
(12/s). This also softens the distant 5Hz updates without increasing the simulation
rate. Culling bounds use the displayed positions. Shared model heading offsets,
24-car budget, 55m simulation threshold and 100m visibility cutoff are unchanged.
Display poses add a small visual following delay (about 83ms response time);
they never feed back into navigation or the multiplayer service.

`node --import tsx scripts/test-traffic.ts` checks route continuity and tangent
continuity for ordinary routes, wide-road bus routes and dead ends.
`node scripts/test-traffic-turns-browser.mjs` checks actual GPU instance matrices
under deterministic simulation steps and records a separate screenshot/telemetry
observation. See `docs/performance/traffic-turns-validation.md` for conditions.
