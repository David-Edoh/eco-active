# Tinubu Square building research and matching

Research date: 21 October 2026. Goal: improve the existing ±180 m playable district,
not invent an exact surveyed replica from stock buildings. Geometry is anchored
to the checked-in OSM extract; source photographs are **visual references only**.
No Google, stock-site or Commons photographs are embedded as runtime textures.

## What was inspected

1. **OpenStreetMap local extract**, downloaded 21 October 2026:
   https://www.openstreetmap.org/api/0.6/map?bbox=3.3875,6.4518,3.3913,6.4557
   ODbL; original `docs/references/tinubu.osm` is retained. Nodes, way IDs,
   heights/levels and north/east projection are preserved. Heights absent from
   the extract cannot be described as measured. `placement-audit.json` preserves
   every selected footprint, source/estimated height and appearance confidence.
2. **Jeremy Weate, 2 August 2014, CC BY 2.0**, square-front view:
   https://commons.wikimedia.org/wiki/File:2014_Tinubu_Square_Lagos_Nigeria_14640600637.jpg
   Inspected the visible cream institutional blocks, balcony bands, darker glass
   wings and tower/crown silhouette behind the fountain. This is dated evidence,
   not a claim that all facades remain unchanged in 2026.
3. **Chukwuka Tolulope Obu, 1 August 2016**, inside-square counter-view:
   https://commons.wikimedia.org/wiki/File:Tinubu_Square_Inside.jpg
   Commons identifies CC BY-SA 4.0 (embedded EXIF also contains an older rights
   notice). Used as a viewed reference only. Shows different commercial facades,
   horizontal balcony/slab bands and a much greener foreground than this game.
4. **Google Maps public Tinubu Square gallery**, Kelvin Edache, March 2019:
   https://www.google.com/maps/search/Tinubu+Square+Lagos
   Inspected the square-front photo, including the modern glass building and
   differing flanking towers. The public page reported **no Street View imagery
   available here** in this session; these are photographs, not a complete 360°
   survey. Contributor photographs remain on Google and are not redistributed.
5. **Julius Berger, CBN Lagos Office**, primary builder record and elevated
   construction-gallery view:
   https://www.julius-berger.com/references/central-bank-of-nigeria-lagos-office
   Publishes 99.9 m overall height, 23 storeys, five parking levels, office floors
   6–19, a circular penthouse and helipad. Inspected the elevated neighborhood
   view for relative tower massing and the podium/wing description. Its stated
   overall height is used; dimensions of individual wings remain estimates.
6. **Trinity Church facade**, Google Maps public gallery, Paul Odijie, March 2021:
   https://www.google.com/maps/search/Methodist+Church+of+the+Trinity+Tinubu+Lagos
   Inspected the inverted-ark profile, prominent cross, glazed entrance bay and
   rear clock-tower silhouette. Map result and neighboring streets corroborate
   the site association; the particular OSM-footprint association is inferred.
7. **World Day of Prayer International, Nigeria 2026**, primary organization:
   https://worlddayofprayer.net/nigeria-2026.html
   Its named Methodist Church of the Trinity photograph corroborates church
   identity, with a different frontal/event view. No photograph is copied.
8. **Mosaic House property descriptions**, 22 December 2020 and 3 October 2026:
   https://propertypro.ng/property/commercial-property-for-sale-tinubu-square-lagos-island-lagos-2DNLX
   https://nigeriapropertycentre.com/for-sale/commercial/plaza-complex-mall/lagos/lagos-island/3708600-twin-block-commercial-complex
   Both describe twin blocks of five floors beside Holy Trinity, around 2,500 m².
   This is corroborating context, not an architectural survey. The adjacent
   footprint is tagged only as a **candidate**, with low identity confidence.
9. **Bookshop House** reference and mapped 15 levels:
   https://commons.wikimedia.org/wiki/File:CSS_Bookshop.jpg
   https://www.openstreetmap.org/way/669978762
   The named footprint just beyond the walking boundary is retained in its mapped
   location. A stock office proxy is used, not a claimed recreation of its fins.
10. **Historical context**, used to avoid mixing eras:
    https://whatsonlagos.com/2021/03/07/renaming-tinubu-square-and-why-documentation-is-everything/
    https://en.wikipedia.org/wiki/Ilojo_Bar
    Colonial/1960s views do not establish today's buildings. Ilojo Bar was
    demolished in 2016; no surviving historical mansion is invented on that site.
    Generic web searches also return Abuja's CBN HQ and the Gothic Cathedral of
    Christ at Marina; neither is substituted for Tinubu's Trinity Church.

## Source-pack audit

The entire supplied template and its parent asset tree were searched for building
FBX/OBJ/DAE models. `Models/City/Models/City.fbx` contains only three reusable upright
building variants. `CityBuilding_4_` is about 136 × 1.65 × 179 m: ground/site
geometry, **not a fourth tower**. See `unity-inventory.json` for exact bounds and
material slots. Existing imported facades had been collapsed into just wall and
window materials. The new converter preserves default walls, red masonry, concrete
trim and both window types, with baked vertex ambient shading.

No extra stock houses are claimed to have been found. Ordinary buildings reuse
those three locally copied models and four floor-band derivatives, with seven
shared ordinary material profiles. Two small
custom landmark models are authored because those landmarks are absent from the
pack; they use the existing local Unity-derived materials. Source and license
provenance are in `public/assets/licenses/building-assets.json`.

## Matching decisions

| Location / evidence | Model decision | Confidence and limitations |
| --- | --- | --- |
| CBN Lagos, OSM way 544005150, mapped 100 m | New `cbn-lagos` silhouette; published 99.9 m, parking podium, glass wings, circular crown | Medium site association; published overall height, estimated wing sizes and facade details |
| Trinity, OSM way 705875899 association | New `tinubu-trinity` inverted-ark silhouette, cross and rear tower | Medium association; approximate 27 m including tower, not a surveyed height |
| Mosaic candidate, adjacent way 705875897 | Supplied low/mid-rise model 2, cream render, five estimated 3.3 m floors | Low identity confidence; candidate is explicitly unverified |
| Mapped towers ≥32 m, including Union Bank (124 m) | Tall supplied model 1, ivory/sand profile | Mapped location/height; facade and floor layout are proxies |
| Mid-rises 17–32 m | Supplied model 3, grey or ochre profile | Height/type and neighborhood-context fit, no claimed exact facade |
| Lower commercial blocks | Supplied model 2 / floor-band derivatives, cream, weathered or ochre render | Contextual proxy; supplied model's floor count may differ |
| Bookshop House, way 669978762 | Tall supplied office proxy at its actual map location | Name and levels mapped; characteristic facade fins not reproduced |

Old `OSM-ID modulo 3` model selection and `ID modulo 5` guessed height variation
are removed. Unknown heights use explicitly labeled area/context estimates of
three, four or five floors. OSM heights and OSM levels take priority; only curated,
documented overrides can supersede them. Every building has `heightSource` and
`appearanceSource`; no uncertain candidate is silently upgraded to verified.

One- through four-storey derivatives remove whole floor bands from the supplied
commercial model and reuse its original roof. They are derivatives of the supplied
asset, not four newly discovered Unity prefabs. Contextual ochre/cream/weathered
choices are interpretations of the mixed commercial streetscape, not verified
paint samples for individual addresses.

The oriented rectangle is now centred on its projected bounds, fixing drift from
averaging unevenly sampled polygon vertices. It still approximates nonrectangular
footprints; corners, setbacks, roof shapes, signage and rear elevations need
surveyed measurements and additional licensed facade capture for exact fidelity.

## Reproduction and remaining fidelity work

- `node scripts/convert-buildings.mjs src/assets/models/roads` regenerates the
  three original GLBs, four floor-band derivatives, two custom landmark GLBs and source inventory from the
  **checked-in** City FBX. Runtime never accesses the external Unity project.
- `python3 scripts/build-world.py` rebuilds placements, the per-building audit and
  road surfaces. Material/profile metadata is `public/assets/world/building-catalog.json`;
  curated evidence is `assignments.json` beside this report.
- Five mapped towers remain resident as one bounded skyline group, using shared
  session geometry/materials. Ordinary district buildings remain chunk-streamed.
  A 340 m far clip makes these nearby mapped towers visible; it does not load
  the entire city. Ground extends beyond that view distance.
- Exact present-day reconstruction still needs dated, calibrated multi-view
  photographs for each facade, actual heights, polygonal massing and distinctive
  skyline models (including Union Bank and Bookshop House). Stock meshes are
  deliberately labeled approximations rather than exact replicas.

## Finite district backdrop correction

The camera far clip (340m) exceeded ordinary chunk residency (85/110m), so
unloaded mapped buildings left open ground visible. District.distant now carries
low-detail building projections with the same mapped positions, footprint sizes
and heights. Supplied three-floor derivatives are used for distant display;
this does not replace geographic records or assert a matching facade.

Two authored rows beyond the walking district (264/300m perimeter coordinates)
reuse the supplied two-floor derivative to close outer sightlines. Their IDs
start with scenic-, their name is Approximate city backdrop, and their height/
appearance sources explicitly identify fictional scenery. They are not in the
mapped placement audit, collision buildings, navigation or minimap. No additional
real-world building identity or map accuracy is claimed. All geometry and notices
were already copied into the project; no external source project is read at runtime.
