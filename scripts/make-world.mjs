// BUILDS THE WORLD MAP used on the Map screen's "World" view.
// Run with:  npm run world
//
// It reads Natural Earth's country outlines (the "India point of view"
// edition, already downloaded for the India map: see CREDITS.md) and writes
// one small file the app uses:
//
//   src/map/world.ts   the outline of every country, simplified a lot,
//                      with its name and a box to zoom onto it
//
// HOW POSITIONS WORK
// Like the India map, this uses the "Web Mercator" projection (the round
// Earth unrolled onto a flat square), here WORLD_WIDTH units wide. The far
// north and south are cut off: nobody pins Antarctica, and Mercator
// stretches the poles enormously.

import { readFileSync, writeFileSync } from 'node:fs'

const WORLD_WIDTH = 1000
const NORTH = 78 // the top edge (latitude)
const SOUTH = -56 // the bottom edge (just below South America's tip)

function mercatorY(lat) {
  const radians = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180
  return Math.asinh(Math.tan(radians))
}

const TOP = mercatorY(NORTH)
const BOTTOM = mercatorY(SOUTH)
// One unit across = one unit down, so shapes keep their proper look.
const SCALE = WORLD_WIDTH / (2 * Math.PI)
const WORLD_HEIGHT = (TOP - BOTTOM) * SCALE

// A point on the Earth -> its place on the world map.
function project([lon, lat]) {
  const x = ((lon + 180) / 360) * WORLD_WIDTH
  const clamped = Math.max(SOUTH, Math.min(NORTH, lat))
  const y = (TOP - mercatorY(clamped)) * SCALE
  return [x, y]
}

// Every ring (closed loop of points) of a country, projected.
function ringsOf(geometry) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.flatMap((polygon) => polygon.map((ring) => ring.map(project)))
}

// ---------------------------------------------------------------------------
// Simplifying (the same method as scripts/make-map.mjs)
// ---------------------------------------------------------------------------

// Drops points that barely change a line's shape (Douglas-Peucker).
function simplify(points, tolerance) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()
    const [ax, ay] = points[first]
    const [bx, by] = points[last]
    const dx = bx - ax
    const dy = by - ay
    const length = Math.hypot(dx, dy) || 1
    let worst = 0
    let worstAt = -1
    for (let i = first + 1; i < last; i++) {
      const distance = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / length
      if (distance > worst) {
        worst = distance
        worstAt = i
      }
    }
    if (worst > tolerance) {
      keep[worstAt] = 1
      stack.push([first, worstAt], [worstAt, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

// A ring starts and ends at the same point: cut it in two at the point
// furthest from the start, simplify each half, and join them again.
function simplifyRing(ring, tolerance) {
  let far = 0
  let farthest = 0
  for (let i = 1; i < ring.length; i++) {
    const distance = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
    if (distance > farthest) {
      farthest = distance
      far = i
    }
  }
  if (far === 0) return ring
  const firstHalf = simplify(ring.slice(0, far + 1), tolerance)
  const secondHalf = simplify(ring.slice(far), tolerance)
  return [...firstHalf, ...secondHalf.slice(1)]
}

function areaOf(ring) {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(sum) / 2
}

// The smallest a country is drawn: a diamond this many units from its middle
// to each corner, so tiny island nations (Maldives, Singapore...) can still
// be seen and tapped.
const DOT = 1.4

// Rings -> SVG path text. Tiny islands are dropped; a country too small to
// keep any shape at all becomes a small diamond instead.
function pathOf(rings, tolerance, smallest) {
  const path = rings
    .filter((ring) => areaOf(ring) >= smallest)
    .map((ring) => simplifyRing(ring, tolerance))
    .filter((ring) => ring.length >= 4)
    .map((ring) => 'M' + ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z')
    .join('')
  if (path !== '') return path
  const [left, top, width, height] = boxOf(rings)
  const x = left + width / 2
  const y = top + height / 2
  const corners = [
    [x, y - DOT],
    [x + DOT, y],
    [x, y + DOT],
    [x - DOT, y],
  ]
  return 'M' + corners.map(([cx, cy]) => `${cx.toFixed(1)} ${cy.toFixed(1)}`).join('L') + 'Z'
}

function boxOf(rings) {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  const round = (n) => Math.round(n * 10) / 10
  return [round(left), round(top), round(right - left), round(bottom - top)]
}

// ---------------------------------------------------------------------------
// Building the file
// ---------------------------------------------------------------------------

const data = JSON.parse(readFileSync('map-data/countries_ind.geojson', 'utf8'))

const countries = data.features
  .filter((feature) => feature.properties.CONTINENT !== 'Antarctica')
  .map((feature) => {
    const p = feature.properties
    // A short id: the 2-letter ISO code when there is one, else Natural
    // Earth's own 3-letter code. ISO_A2_EH ("even if") is only used for the
    // country itself, not for small territories that share its code (France
    // gets "fr", its Clipperton Island gets "clp").
    const isCode = (code) => /^[A-Z]{2}$/.test(code)
    const iso2 = isCode(p.ISO_A2)
      ? p.ISO_A2
      : isCode(p.ISO_A2_EH) && p.ADM0_A3 === p.ISO_A3_EH
        ? p.ISO_A2_EH
        : undefined
    const id = (iso2 ?? p.ADM0_A3).toLowerCase()
    const rings = ringsOf(feature.geometry)
    return { id, name: p.NAME, rings }
  })
  .map((country) => ({
    id: country.id,
    name: country.name,
    box: boxOf(country.rings),
    path: pathOf(country.rings, 0.5, 1.2),
  }))
  .filter((country) => country.path !== '')
  .sort((a, b) => a.name.localeCompare(b.name))

// Ids must be unique; a rare clash gets a number added.
const seen = new Map()
for (const country of countries) {
  const count = seen.get(country.id) ?? 0
  seen.set(country.id, count + 1)
  if (count > 0) country.id = `${country.id}${count + 1}`
}

const map = {
  width: WORLD_WIDTH,
  height: Math.round(WORLD_HEIGHT * 10) / 10,
  north: NORTH,
  south: SOUTH,
  countries,
}

const source = `// THE WORLD MAP: a simple outline of every country.
// MADE BY A SCRIPT - do not edit by hand. To change it, edit
// scripts/make-world.mjs and run:  npm run world
//
// The shapes come from Natural Earth (public domain), "India point of view"
// edition. See CREDITS.md.
//
// Positions are on the world map's own grid, \`width\` wide and \`height\`
// tall (Web Mercator, from longitude -180 to 180 and latitude \`north\` to
// \`south\`). A \`box\` is [left, top, width, height] around a country.

export type WorldCountry = {
  id: string // a short code, like "fr" for France
  name: string
  box: readonly [number, number, number, number]
  path: string
}

export const WORLD_MAP: {
  width: number
  height: number
  north: number
  south: number
  countries: readonly WorldCountry[]
} = ${JSON.stringify(map)}
`

writeFileSync('src/map/world.ts', source)
console.log(
  `wrote src/map/world.ts (${countries.length} countries, ${Math.round(source.length / 1024)} KB)`,
)
