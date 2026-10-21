# Bus and keke transport layer

The user supplied `bus.fbx` and `keke.fbx` from the same Hide and Seek Unity
project as the roadside stalls. The models live in `Assets/Models/`. Their
Unity importer metadata resolves the albedo atlases via GUIDs, recorded in
`public/assets/licenses/transport-assets.json`; no external runtime URLs remain.
The original meshes and paint details are retained, uniformly scaled to estimated
heights of 2.1m for the minibus and 1.85m for the keke. Resulting bounds are roughly
2.41×2.1×4.87m and 1.55×1.85×2.83m. These are stylized asset proportions, not exact
vehicle specifications. Original geometry is merged/indexed and receives the same
eight-ray local ambient-shading bake used by the supplied stalls. Albedo textures
are capped at 1024px WebP; this is transfer compression, not GPU block compression.

No separate bus/keke license notice was found beside these FBXs. The previously
copied source project's Platformer Project README remains in assets/licenses;
no new license or distribution rights are inferred. Unity prefab scripts and
physics are not imported.

## Moving traffic

The existing local ambient traffic budget stays at 24: six sedans, six wagons,
four sports cars, four buses and four kekes. Buses select routes over roads at
least 10m wide; kekes use the existing 7m minimum network. Spawn anchors keep both
new types around the playable approaches instead of selecting a distant connected
road component by batch index. Nearby vehicles update every frame, distant ones
at 5Hz and rendered ones remain within 100m of the local player.

The mesh's front faces local +Z. Navigation yaw therefore maps directly to the
bus/keke instance heading. Existing sedan offset remains 180 degrees. Wheels and
vehicle bodies are one static supplied mesh; there is no additional wheel steering,
rigid-body physics, traffic lights or vehicle-to-vehicle collision AI. The source
ECS position/yaw controls the rendered instance, and traffic remains local ambient
simulation rather than synchronized multiplayer state.

## Parked clusters

The requested clustered parking pattern is authored as three coherent motor-park
pockets in existing open forecourts:

| Pocket | Buses | Kekes |
| --- | ---: | ---: |
| Custom Street bus rank | 4 | 0 |
| Custom Street keke rank | 0 | 5 |
| Alli junction keke rank | 0 | 3 |

These locations are estimates chosen for the game and are not a surveyed parking
map, a present-day vehicle census, or verified legal parking bays. Uniform rank
headings and compact spacing communicate grouped waiting vehicles rather than
randomly scattered props. Candidate whole rows shift together to fit existing
geometry; unsafe slots are omitted. Park, buildings, road corridors, the spawn,
shop entrances and NPC attendant positions retain clearance. The failed fourth
candidate bus pocket is omitted rather than forcing vehicles through a building.

`parking-audit.json` records every parked position, model, heading and footprint.
Parked bodies share the moving model's loaded geometry/materials but use static
chunk instance buffers. Each loaded parked vehicle has a Miniplex entity tagged
with its chunkId. Eviction destroys its buffer and removes its ECS record. No
parked vehicle has moving navigation. The static collision layer also makes parked
bodies solid to the player, camera and pedestrians.

## Reproduce and verify

```sh
node scripts/convert-vendor-assets.mjs '<hide-and-seek-project>' --vehicles
node scripts/build-transport-parking.mjs
node --import tsx scripts/test-transport.mjs
node --import tsx scripts/test-streaming.mjs
node --import tsx scripts/test-traffic.ts
node scripts/test-transport-browser.mjs
```

The full offline world build reapplies roadside stalls before parked vehicles.
The browser test defaults to port 3100 and accepts GAME_TEST_URL. Exact measured
conditions and screenshots are recorded in docs/performance/transport-results.json.
