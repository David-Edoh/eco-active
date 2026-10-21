# Tinubu Square decoration reconstruction

Research and implementation: 21 October 2026.

## Evidence and date discipline

The five user-supplied photographs are the principal visual references: close
front, reverse/side, daylight, dusk and elevated whole-park views. Their capture
dates were not supplied. They show different maintenance states; green water is
not a green plaza. They are references only and are not redistributed as textures.

Additional sources searched and viewed:

- https://pmnewsnigeria.com/2017/01/27/ambode-vows-to-preserve-lagos-historical-cultural-heritage/
  Dated 27 January 2017 commissioning coverage with two fountain views. Image
  search previews show the birds, white pool perimeter and landscaped park.
  Direct retrieval of the full image failed; no extra detail is inferred from it.
- https://thesun.ng/lagos-govt-unveils-new-tinubu-square-fountain/
  Dated 15 February 2017, elevated commissioning view. The contractor identifies
  the 2006/2007 work, Madam Efunroye Tinubu statue, Kokoro sculpture and wall relief.
- https://commons.wikimedia.org/wiki/File:Tinubu_square.jpg
  Additional street view, dated 6 June 2019 in the image search result. Reference
  only; not incorporated into runtime assets.
- https://newtelegraphng.com/corner-47-unveils-smart-park-project-for-tinubu-fountain-park-in-lagos/
  Dated 5 September 2026. Describes renovation begun in 2024 and planned lighting,
  security, paths and seating. It does not supply a calibrated multi-view survey
  of completed work. A recent publication date does not date older photographs.
- https://businessday.ng/columnist/article/an-afternoon-of-singing-at-tinubu-square/
  Dated 5 June 2026; confirms the active Trinity Church / Broad Street context,
  but is not facade geometry evidence.

Search summaries contain errors (one image result misidentifies the Tinubu statue
as the current president); those descriptions were not accepted as evidence.

## Implemented visual decisions

- Broad circular pool with white mosaic wall/coping, radial tile joints and pale
  surrounding walkway replaces the small oval proxy.
- Stepped circular pedestal with deterministic irregular stone veneer and dark
  grout; three separately oriented sculptural birds replace the single triangle
  wing proxy. Feather lobes, tails, beaks and curved wing silhouettes are modeled.
- Opposed tapered pale portals have inward lintels and geometric relief lines.
- Two concentric bronze pipe/nozzle rings carry opaque thin arcing jet geometry.
  Portal downflows use similar thin geometry. These are static depictions, not
  simulated or animated water; no transparent particle overdraw is introduced.
- Freestanding extruded white TINUBU SQUARE lettering sits on a dark beam/posts.
- Paved plaza, limited planted islands and horizontal green fence rails replace
  the broad undifferentiated lawn and widely spaced fence posts.

All dimensions, bird poses, stone patterns, portal relief and planting extents
are visual estimates. The figurative Tinubu/Kokoro statues,
wall reliefs, mature trees and ornate lamp/fence details are not reconstructed.
This is a closer photo-informed reconstruction, not an exact surveyed replica
or a verified depiction of completed 2026 renovations.

## Buildings and supplied asset decision

See ../buildings/research.md, unity-inventory.json and placement-audit.json. The
existing local City FBX already supplies all three ordinary building variants,
four floor-band derivatives and mapped placement profiles. CBN and Trinity have
custom silhouettes because those landmarks are absent from the pack. Stock
facades do not exactly match the skyline visible in the supplied photos. No
new unverified building-to-footprint association was introduced in this change.
The existing supplied building/fern assets remain local; no runtime URL points
at the external Unity directory. No additional Unity asset was needed for the
custom fountain, which is absent from that pack.

## Reproduction, ownership and licensing

`node scripts/build-tinubu-monument.mjs` creates
`public/assets/models/tinubu-monument.glb`. Three.js is used offline only. The
11 material groups merge repeated geometry before export. No new dependencies.
The session AssetLibrary loads and owns the GLB. createLandmark instantiates it
and batches static decoration; teardown removes its batch and entities, while
AssetLibrary unloads the shared meshes/materials. No update listener is added.

Letter outlines are from the Three.js Helvetiker bold typeface; local input and
full license are in src/assets/fonts/. The original downloadable source is
https://github.com/mrdoob/three.js/blob/dev/examples/fonts/helvetiker_bold.typeface.json
and its accompanying LICENSE. A runtime-distributed license copy lives in
public/assets/licenses/tinubu-lettering.txt. All other new monument geometry is
procedurally authored from the references; photographs are not runtime assets.

Validation: scripts/test-tinubu-browser.mjs captures front/reverse/overhead and
mobile-emulation views, checks that the local GLB is present, checks mesh groups
and page/network errors, and records hardware/GPU/viewport/quality/telemetry in
docs/performance/tinubu-results.json. These are software-rendered snapshots, not
hardware performance claims or a before/after benchmark.


## Connected basin correction

The additional user-supplied aerial photograph (filename credits Ayo Akinyemi,
2013; metadata not independently verified) shows one large circular basin and two
smaller circular lobes joined end to end. The generator now unions all three
circles and connecting necks before deriving a continuous inset water surface,
white coping, inner/outer walls and surrounding walkway. This removes internal
rim barriers. Satellite nozzle rings are included. The small lobes extend toward
the longer western park section within the retained OSM boundary; radii and
alignment remain visual estimates rather than survey measurements.

The offline planting pass excludes the satellite water and coping bounds, so
streamed ferns cannot appear inside either new lobe.

The connected pad is enlarged 15% horizontally (height unchanged). Its complete
three-lobe bounds, rather than the main circle alone, are centered on the park
polygon centroid (approximately -24.1, -8.65 metres). Fountain origin is now
(-17.3, -8.1); planting exclusions and the approach follow this placement.
