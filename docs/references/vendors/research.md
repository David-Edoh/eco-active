# Tinubu roadside commerce interpretation

Implemented 21 October 2026 from the two photographs supplied in this chat:

- `Aerial-view-of-the-New-Tinubu-Square-Lagos-Photograph-by-Ayo-Akinyemi-2013.webp`.
  Its filename identifies Ayo Akinyemi and 2013; that date has not been independently
  verified. Visible umbrella clusters are concentrated outside the square and
  along commercial frontages/approaches; the park interior remains open.
- `square_1.jpg`, date not supplied. It shows dense trading beyond the church-side
  commercial road and far junction, with intermittent individual umbrellas and
  small vendors around the closer fence/road perimeter. It does not show a uniform
  continuous ring of equally spaced shops around the monument.

These observations are translated into an authored pattern using the existing
local OSM map. The photos are not calibrated plans, so individual stall coordinates,
counts, orientations and dimensions are estimates. The two views show different
states/dates; no claim is made that this depicts the present-day vendor situation.
Neither reference image is redistributed as a runtime texture.

## Asset provenance

All six user-requested models come from `Assets/Models/` in the supplied Hide and
Seek Unity project: `pos_umbrella.fbx`, `shop_1.fbx`, `shop_2.fbx`, `shop_3.fbx`,
`shop_4.fbx`, and `food_vendor.fbx`. They retain their supplied modeled kiosk,
canopy, produce, shelves and cooking/merchandise details; no procedural replacement
shop/furniture is added. Runtime URLs are entirely local to this repository.

`public/assets/licenses/vendor-assets.json` and `world/vendor-catalog.json` record
the actual texture GUID resolution, dimensions, triangle counts and conversion
sizes. Geometry is scaled uniformly to estimated real-world heights of 2.5–2.8m.
Source texture alphas are removed for opaque rendering. No new transparency or
GPU compressed-texture support is claimed. The source folders have no separate
asset-specific license notice; the existing copied project/package README is
preserved in `public/assets/licenses/hide-and-seek-platformer-readme.txt`.

## Placement and density

`placement-audit.json` records 35 placements and six attendant positions:

| Region | Stalls | Pattern |
| --- | ---: | --- |
| Custom Street / church approach | 10 | Closely grouped frontages |
| Broad Street church-side approach | 7 | Closely grouped frontages |
| Eastern commercial approach | 8 | Market row |
| Alli Street junction | 6 | Smaller market cluster |
| Western park approach | 2 | Scattered umbrellas |
| Northern park approach | 2 | Scattered umbrellas |

The attempted northern storefront band has zero accepted placements because the
available mapped gap cannot fit these models with the chosen road/building
clearances. Existing mapped buildings are preserved rather than moved to make
room. Stalls face the road, are grounded on the existing surface and are grouped
by geographic chunk. Blank areas retain walking/traffic space instead of being
filled by a uniform decoration grid.

The builder checks oriented bounds against existing buildings/other stalls,
expanded road corridors, park containment and the local spawn. Independent tests
use Clipper polygon intersections to verify no stall footprint intersects the
park, buildings or road corridor including 0.6m clearance. The normal collision
grid blocks the full stall footprint, including canopy bounds; this deliberately
does not model walking under individual awnings or into the shops.

Six existing NPCs are placed beside selected counters with their original idle
animation; the total population remains twelve. They are ambient local NPCs and
are not network-authoritative shopkeepers or transaction systems.

## Reproduction

```sh
node scripts/convert-vendor-assets.mjs '<hide-and-seek-project>'
node scripts/build-vendor-placements.mjs
node --import tsx scripts/test-vendors.mjs
node --import tsx scripts/test-streaming.mjs
node scripts/test-vendors-browser.mjs
```

The browser test defaults to an isolated local server at port 3100; set
`GAME_TEST_URL` to use another server. Screenshots and exact performance conditions
are recorded in `docs/performance/vendors-results.json`.
