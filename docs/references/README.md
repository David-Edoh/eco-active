# Tinubu Square references

## Geometry

`tinubu.osm` is the OpenStreetMap API 0.6 extract downloaded on 2026-10-21 from:
https://www.openstreetmap.org/api/0.6/map?bbox=3.3875,6.4518,3.3913,6.4557

© OpenStreetMap contributors, Open Database License:
https://www.openstreetmap.org/copyright

Origin: 3.3896° E, 6.4538° N. Local X is east; local Z is south. Conversion uses
111320 metres per degree and cosine correction at the origin. Generation crops
building centres to ±185 m and road samples to ±200 m. Player bounds are ±180 m.
The game contains 132 mapped building footprints (including five persistent skyline
buildings) and independently streamed chunks; most
chunks are not active at once. Road widths are inferred by highway class.

Important mapped features: Tinubu Square way 748641728; Broad Street ways
91328865, 328558543, 1353974309 and 1353974310; Custom Street ways 91328848 and
705875890. OSM data may be incomplete or outdated. No live map service is needed
while playing.

## Visual reference

Jeremy Weate, “2014 Tinubu Square Lagos Nigeria”, 2 August 2014, CC BY 2.0:
https://commons.wikimedia.org/wiki/File:2014_Tinubu_Square_Lagos_Nigeria_14640600637.jpg

Inspected for the pale arches, raised basin, sculptural bird, green perimeter
railing and surrounding commercial buildings. The photo is not embedded in the
runtime. The monument is a simplified custom interpretation. Generic supplied
building facades, inferred heights and sparse planting cannot establish an exact
current architectural replica. Capture/survey matching street facades before
claiming that level of fidelity.

## Road connections (2026-10-21)

The supplied City FBX was inspected: its `CityConstructionObject__1_` through
`__36_` meshes use SideWalks; they include straight strips and authored curved
sidewalk sections, rather than a named modular T/45°/cross asphalt road kit.
`road-asset-inventory.json` records mesh dimensions and materials. The original
City FBX is copied to `src/assets/models/roads/city-source.fbx` for reproducibility;
existing copied paving/asphalt textures and source notices remain under
`public/assets/`. Runtime never loads from the external Unity directory.

Road surfaces are now map-derived fitted geometry, not stretched rectangular
slabs. `npm run world:build` preserves way/node IDs and centerlines, constructs
width-aware mouth joins at shared OSM nodes, unions asphalt, then subtracts it
from the wider sidewalk footprint. This handles T/cross junctions, acute bends
and 45-degree connections at their actual mapped angles. The join is a bevel
between edge mouths, not a surveyed kerb radius. The pack's fixed sidewalk
sections cannot exactly fit these arbitrary angles, so no false prefab matching
is claimed. Geometry is triangulated with holes intact, then clipped to 64 m
chunks with millimetre precision. The existing local Unity-derived materials are
shared by the resulting PlayCanvas meshes. Widths still use highway-class
estimates; this change does not establish exact present-day Lagos geometry.

## Building matching (21 October 2026)

[Building research](buildings/research.md) records multi-view visual inspection,
primary builder information, asset inventory, per-footprint matching and uncertainty.
[Placement audit](buildings/placement-audit.json) retains all 132 selected OSM IDs,
original projected polygons, height provenance and appearance evidence. The pack
has only three genuine upright building variants; two absent landmark silhouettes
are authored locally, with stock proxies used elsewhere. This improves geographic
and visual fidelity but does not establish an exact contemporary replica.
