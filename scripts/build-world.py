"""Build the local OSM district with evidence-aware building selection (metres)."""
import json
import math
import pathlib
import subprocess
import xml.etree.ElementTree as ET

root = ET.parse('docs/references/tinubu.osm').getroot()
origin = [3.3896, 6.4538]
nodes = {n.attrib['id']: [
    (float(n.attrib['lon']) - origin[0]) * 111320 * math.cos(math.radians(origin[1])),
    -(float(n.attrib['lat']) - origin[1]) * 111320,
] for n in root.findall('node')}
catalog = json.loads(pathlib.Path('public/assets/world/building-catalog.json').read_text())
assignments = json.loads(pathlib.Path('docs/references/buildings/assignments.json').read_text())
chunks, roads, buildings, skyline, audit, park = {}, [], [], [], [], []


def add(item):
    key = f"{math.floor(item['x']/64)}_{math.floor(item['z']/64)}"
    chunks.setdefault(key, []).append(item)


def fit_footprint(points):
    # Fit using the longest mapped edge, then use the oriented bounds centre.
    # A vertex average biases irregular/unevenly sampled footprints off their site.
    edges = [(math.dist(a, b), a, b) for a, b in zip(points, points[1:] + points[:1])]
    _, a, b = max(edges)
    angle = math.atan2(b[1]-a[1], b[0]-a[0])
    c, s = math.cos(angle), math.sin(angle)
    xx = [p[0]*c + p[1]*s for p in points]
    zz = [-p[0]*s + p[1]*c for p in points]
    u, v = (min(xx)+max(xx))/2, (min(zz)+max(zz))/2
    return u*c-v*s, u*s+v*c, max(xx)-min(xx), max(zz)-min(zz), -math.degrees(angle)


for way in root.findall('way'):
    tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
    refs = [n.attrib['ref'] for n in way.findall('nd')]
    pts = [nodes[ref] for ref in refs]
    ident = way.attrib['id']
    if tags.get('name') == 'Tinubu Square':
        park = pts
    if tags.get('building'):
        p = pts[:-1] if refs[0] == refs[-1] else pts
        x, z, w, d, yaw = fit_footprint(p)
        override = assignments.get(ident, {})
        mapped_height = float(tags.get('height', 0) or 0)
        # Keep known skyline buildings just outside the walking boundary.
        if max(abs(x), abs(z)) > 185 and not (
            max(abs(x), abs(z)) < 270 and (mapped_height >= 50 or tags.get('name') == 'Bookshop House')
        ):
            continue
        if mapped_height:
            h, height_source = mapped_height, 'OSM height'
        elif tags.get('building:levels'):
            h, height_source = float(tags['building:levels'])*3.3, 'OSM levels × estimated 3.3 m floor height'
        else:
            levels = 5 if w*d > 1200 else 4 if w*d > 350 else 3
            h, height_source = levels*3.3, 'unverified contextual estimate; no mapped height/levels'
        h = override.get('height', h)
        height_source = override.get('heightSource', height_source)
        # Height/type matching replaces ID-modulo selection; no random height claims.
        if h >= 32:
            profile = 'office-ivory' if x < 0 else 'office-sand'
        elif h >= 17:
            profile = 'market-grey' if x < 0 else 'market-ochre'
        else:
            profile = ('commercial-ochre' if x > 35 and d < 13 else
                       'commercial-cream' if z > 0 or w/d > 2.8 else 'commercial-weathered')
        profile = override.get('profile', profile)
        definition = catalog['profiles'][profile]
        level = max(1, round(h/3.3))
        model = definition.get('levelModels', {}).get(str(level), definition['model'])
        base = catalog['models'][model]['size']
        appearance = override.get('appearanceSource', 'closest supplied building by height class and local streetscape; individual facade unverified')
        item = dict(kind='building', model=model, profile=profile,
                    x=round(x, 3), z=round(z, 3), y=.13, yaw=round(yaw, 3),
                    sx=round(w/base[0], 5), sy=round(h/base[1], 5), sz=round(d/base[2], 5),
                    w=round(w, 3), d=round(d, 3), height=round(h, 3), id=ident,
                    heightSource=height_source, appearanceSource=appearance)
        if override.get('name') or tags.get('name'):
            item['name'] = override.get('name', tags.get('name'))
        buildings.append(item)
        if h >= 50:
            skyline.append(item)
        else:
            add(item)
        audit.append(dict(id=ident, name=item.get('name'), model=model, profile=profile,
                          height=h, heightSource=height_source, appearanceSource=appearance,
                          footprint=p, fit='oriented bounding rectangle, not exact polygon facade',
                          references=override.get('references', []), confidence=override.get('confidence', 'mapped footprint, proxy facade')))
    if tags.get('highway') in ['primary', 'secondary', 'residential', 'service']:
        width = {'primary': 12, 'secondary': 10, 'residential': 7, 'service': 4}[tags['highway']]
        for index, (a, b) in enumerate(zip(pts, pts[1:])):
            if math.dist(a, b) < .01:
                continue
            if min(a[0], b[0]) < 210 and max(a[0], b[0]) > -210 and min(a[1], b[1]) < 210 and max(a[1], b[1]) > -210:
                roads.append(dict(id=ident, nodeIds=refs[index:index+2], name=tags.get('name', 'Lane'), points=[a, b], width=width))

# Ground is supplied by the sealed session base; do not generate tapered curb tiles.
# Preserve existing garden planting and the OSM park boundary.
def inside(x, z):
    result = False
    for a, b in zip(park, park[1:]):
        if (a[1] > z) != (b[1] > z) and x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:
            result = not result
    return result


for x in range(-72, 12, 3):
    for z in range(-27, 15, 3):
        # Keep fern bounds clear of the connected satellite pools and coping.
        clear_satellites = all(math.hypot(x-cx, z-cz) > radius + 2
                               for cx, cz, radius in [(-32.25, -14.425, 3.565), (-39.15, -17.3, 3.68)])
        if inside(x, z) and math.hypot(x+17.3, z+8.1) > 15 and clear_satellites and (x+z) % 4 == 0:
            add(dict(kind='vegetation', model='fern', x=x, z=z, y=.2, yaw=(x*17+z*31) % 360, sx=2, sy=2, sz=2))
out = pathlib.Path('public/assets/world')
out.mkdir(exist_ok=True)
for old in out.glob('chunk-*.json'):
    old.unlink()
manifest = []
for key, items in chunks.items():
    x, z = map(int, key.split('_'))
    (out/f'chunk-{key}.json').write_text(json.dumps(items, separators=(',', ':')))
    manifest.append(dict(id=key, x=x*64+32, z=z*64+32, url=f'/assets/world/chunk-{key}.json'))
# Distant stand-ins reuse local supplied floor-band geometry. These are display
# projections only; collision and geographic records remain in buildings/audit.
distant = []
proxy_model = 'building-low-3'
proxy_size = catalog['models'][proxy_model]['size']
for item in buildings:
    if item in skyline:
        continue
    proxy = dict(item)
    if item['model'] != 'tinubu-trinity':
        proxy.update(model=proxy_model, sx=item['w']/proxy_size[0],
                     sy=item['height']/proxy_size[1], sz=item['d']/proxy_size[2])
    distant.append(proxy)
# Finite scenic perimeter beyond the playable/mapped streets. Not real addresses
# or surveyed Lagos footprints. Two staggered rows prevent open sightline gaps.
backdrop_size = catalog['models']['building-low-2']['size']
for row, extent in enumerate([264, 300]):
    for side in range(4):
        for index, along in enumerate(range(-288, 289, 32)):
            along += 16 * row
            if abs(along) > extent:
                continue
            x, z = [(along, -extent), (extent, along),
                    (-along, extent), (-extent, -along)][side]
            height = 20 + ((index * 7 + side * 3 + row) % 5) * 4
            distant.append(dict(kind='building', model='building-low-2',
                profile='commercial-cream' if (index+side)%2 else 'market-grey',
                id=f'scenic-{row}-{side}-{index}', name='Approximate city backdrop',
                x=x, y=.13, z=z, yaw=side*90, w=35, d=30, height=height,
                sx=35/backdrop_size[0], sy=height/backdrop_size[1], sz=30/backdrop_size[2],
                heightSource='authored scenery, not surveyed',
                appearanceSource='local Unity-derived geometry; fictional peripheral placement'))
(out/'district.json').write_text(json.dumps(dict(origin=origin, attribution='© OpenStreetMap contributors · ODbL', bounds=180,
                                               chunks=manifest, roads=roads, buildings=buildings, skyline=skyline, distant=distant, park=park, spawn=[-18, 24]), separators=(',', ':')))
pathlib.Path('docs/references/buildings/placement-audit.json').write_text(json.dumps(audit, indent=2))
print(len(buildings), 'mapped footprints,', len(skyline), 'skyline buildings,', len(chunks), 'streamable chunks')
subprocess.run(['node', 'scripts/build-road-surfaces.mjs'], check=True)

# Reapply authored stalls after road surfaces; do not discard commerce on rebuild.
subprocess.run(['node', 'scripts/build-vendor-placements.mjs'], check=True)

# Place clustered transport after stalls so their entrances retain clearance.
subprocess.run(['node', 'scripts/build-transport-parking.mjs'], check=True)
