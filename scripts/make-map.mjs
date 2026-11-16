// BUILDS THE MAP OF INDIA used on the Map screen.
// Run with:  npm run map
//
// It reads the raw downloads in the map-data folder (see CREDITS.md for
// where they come from) and writes two small files the app uses:
//
//   public/map/india-relief.png  the terrain picture: colour by height,
//                                with soft shading on the slopes
//   src/map/india.ts             the outline of India and of each state
//   public/map/india-heights.png the height of the land, hidden in a picture,
//                                so the app can tell how high a pin is
//
// The raw downloads are large and are NOT kept in the project's history.
// To rebuild from scratch, fetch them again (the list is in CREDITS.md).
//
// HOW POSITIONS WORK
// Maps on the web use the "Web Mercator" projection: the round Earth is
// unrolled onto a flat square. At zoom level 6 that square is 16,384 pixels
// wide. Everything here is measured in those pixels, then moved so the top
// left corner of our piece of the map is (0, 0).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { makePng } from './png.mjs'

const DATA = 'map-data'
const ZOOM = 6
const TILE = 256
const WORLD = TILE * 2 ** ZOOM // 16,384: the width of the whole world

// The piece of the world to draw: a box around India and its islands.
const WEST = 67.3
const EAST = 98.2
const NORTH = 37.9
const SOUTH = 5.9

// The downloaded elevation tiles cover columns 44-49 and rows 24-31.
const TILE_X0 = 44
const TILE_Y0 = 24
const TILES_WIDE = 6
const TILES_HIGH = 8

// How big the picture is compared with the data: 1 keeps every reading, so
// the terrain stays as sharp as it can when the map is zoomed in.
const PICTURE_SCALE = 1

// ---------------------------------------------------------------------------
// Projection: longitude / latitude -> pixels
// ---------------------------------------------------------------------------

function worldX(lon) {
  return ((lon + 180) / 360) * WORLD
}

function worldY(lat) {
  const radians = (lat * Math.PI) / 180
  return ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * WORLD
}

// Our box, in world pixels.
const LEFT = worldX(WEST)
const TOP = worldY(NORTH)
const WIDTH = worldX(EAST) - LEFT
const HEIGHT = worldY(SOUTH) - TOP

// A point on the Earth -> its place inside our box.
function project([lon, lat]) {
  return [worldX(lon) - LEFT, worldY(lat) - TOP]
}

// ---------------------------------------------------------------------------
// Reading the elevation tiles
// ---------------------------------------------------------------------------

// Reads a PNG picture file into its raw red, green, blue (and maybe alpha)
// numbers. Only the plain kind of PNG these tiles use is supported.
function readPng(path) {
  const file = readFileSync(path)
  let at = 8 // skip the 8-byte PNG signature
  let width = 0
  let height = 0
  let channels = 3
  const parts = []
  while (at < file.length) {
    const length = file.readUInt32BE(at)
    const type = file.toString('ascii', at + 4, at + 8)
    const data = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const depth = data[8]
      const colourType = data[9]
      if (depth !== 8 || (colourType !== 2 && colourType !== 6) || data[12] !== 0) {
        throw new Error(`${path}: a kind of PNG this script cannot read`)
      }
      channels = colourType === 6 ? 4 : 3
    } else if (type === 'IDAT') {
      parts.push(data)
    }
    at += 12 + length
  }

  // The pixel data is squeezed (deflate) and each row is "filtered": stored
  // as differences from its neighbours. Undo both.
  const raw = inflateSync(Buffer.concat(parts))
  const stride = width * channels
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const rowIn = y * (stride + 1) + 1
    const rowOut = y * stride
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[rowOut + i - channels] : 0
      const up = y > 0 ? pixels[rowOut - stride + i] : 0
      const upLeft = y > 0 && i >= channels ? pixels[rowOut - stride + i - channels] : 0
      let predicted = 0
      if (filter === 1) predicted = left
      else if (filter === 2) predicted = up
      else if (filter === 3) predicted = (left + up) >> 1
      else if (filter === 4) {
        // "Paeth": whichever neighbour is closest to left + up - upLeft.
        const guess = left + up - upLeft
        const dLeft = Math.abs(guess - left)
        const dUp = Math.abs(guess - up)
        const dUpLeft = Math.abs(guess - upLeft)
        predicted = dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft
      }
      pixels[rowOut + i] = (raw[rowIn + i] + predicted) & 255
    }
  }
  return { width, height, channels, pixels }
}

// One big grid of heights in metres, stitched together from all the tiles.
const GRID_WIDE = TILES_WIDE * TILE
const GRID_HIGH = TILES_HIGH * TILE
const heights = new Float32Array(GRID_WIDE * GRID_HIGH)

for (let tx = 0; tx < TILES_WIDE; tx++) {
  for (let ty = 0; ty < TILES_HIGH; ty++) {
    const tile = readPng(`${DATA}/tiles/${ZOOM}-${TILE_X0 + tx}-${TILE_Y0 + ty}.png`)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const at = (y * TILE + x) * tile.channels
        // The tiles hide the height in the colour: red counts 256s, green
        // counts 1s, blue counts 256ths, all shifted up by 32,768 metres.
        const metres =
          tile.pixels[at] * 256 + tile.pixels[at + 1] + tile.pixels[at + 2] / 256 - 32768
        heights[(ty * TILE + y) * GRID_WIDE + tx * TILE + x] = metres
      }
    }
  }
}

// The height at a place inside our box (in box pixels).
const GRID_LEFT = LEFT - TILE_X0 * TILE
const GRID_TOP = TOP - TILE_Y0 * TILE
function heightAt(x, y) {
  const gx = Math.min(GRID_WIDE - 1, Math.max(0, Math.round(x + GRID_LEFT)))
  const gy = Math.min(GRID_HIGH - 1, Math.max(0, Math.round(y + GRID_TOP)))
  return heights[gy * GRID_WIDE + gx]
}

// ---------------------------------------------------------------------------
// Reading the outlines
// ---------------------------------------------------------------------------

// Every ring (closed loop of points) of a map shape, projected into our box.
function ringsOf(geometry) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.flatMap((polygon) => polygon.map((ring) => ring.map(project)))
}

// India's outline, from Natural Earth's "India point of view" country file.
const countries = JSON.parse(readFileSync(`${DATA}/countries_ind.geojson`, 'utf8'))
const india = countries.features.find((f) => f.properties.ADM0_A3 === 'IND')
const indiaRings = ringsOf(india.geometry)

// The states and union territories.
const allStates = JSON.parse(readFileSync(`${DATA}/states50.geojson`, 'utf8'))
const states = allStates.features
  .filter((f) => f.properties.adm0_a3 === 'IND')
  .map((f) => ({ name: f.properties.name, rings: ringsOf(f.geometry) }))
  .sort((a, b) => a.name.localeCompare(b.name))

// ---------------------------------------------------------------------------
// Which pixels are inside India?
// ---------------------------------------------------------------------------

const PICTURE_WIDE = Math.round(WIDTH * PICTURE_SCALE)
const PICTURE_HIGH = Math.round(HEIGHT * PICTURE_SCALE)

// Fills a shape into a grid of 0s and 1s, one row at a time: for each row,
// find where the shape's edges cross it, then fill between pairs of crossings.
function fillMask(rings, wide, high, scale) {
  const mask = new Uint8Array(wide * high)
  for (let row = 0; row < high; row++) {
    const y = (row + 0.5) / scale
    const crossings = []
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j]
        const [x2, y2] = ring[i]
        if (y1 > y !== y2 > y) {
          crossings.push((x1 + ((y - y1) / (y2 - y1)) * (x2 - x1)) * scale)
        }
      }
    }
    crossings.sort((a, b) => a - b)
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.round(crossings[k]))
      const to = Math.min(wide, Math.round(crossings[k + 1]))
      for (let x = from; x < to; x++) mask[row * wide + x] = 1
    }
  }
  return mask
}

const insideIndia = fillMask(indiaRings, PICTURE_WIDE, PICTURE_HIGH, PICTURE_SCALE)

// ---------------------------------------------------------------------------
// Painting the terrain picture
// ---------------------------------------------------------------------------

// Colours as [red, green, blue]. Soft, to sit well with the rest of the app.
const SEA = [214, 230, 245]
const OTHER_LAND = [233, 230, 222] // land outside India: plain, no detail

// Inside India the colour depends on the height. Each line is "below this
// many metres, use this colour", with the words shown in the map's key.
const BANDS = [
  [150, [201, 230, 201], 'Under 150 m'], // low plains and coasts: green
  [400, [221, 236, 196], '150 to 400 m'], // higher plains
  [800, [243, 233, 180], '400 to 800 m'], // plateaus: yellow
  [1500, [246, 213, 166], '800 to 1,500 m'], // hills: sand
  [3000, [238, 186, 160], '1,500 to 3,000 m'], // mountains: clay
  [4500, [219, 196, 214], '3,000 to 4,500 m'], // high mountains: mauve
  [Infinity, [250, 248, 252], 'Over 4,500 m'], // highest peaks and ice
]

function bandColour(metres) {
  for (const [below, colour] of BANDS) if (metres < below) return colour
  return BANDS[BANDS.length - 1][1]
}

const relief = makePng(PICTURE_WIDE, PICTURE_HIGH, (px, py) => {
  const x = (px + 0.5) / PICTURE_SCALE
  const y = (py + 0.5) / PICTURE_SCALE
  const metres = heightAt(x, y)

  if (!insideIndia[py * PICTURE_WIDE + px]) return metres <= 0 ? SEA : OTHER_LAND

  // Shading: slopes facing the top-left (where the "sun" is) are a touch
  // lighter, slopes facing away a touch darker. Kept to three steps so the
  // picture stays flat and clean.
  const slope = heightAt(x + 2, y + 2) - heightAt(x - 2, y - 2)
  const shade = slope > 250 ? 0.93 : slope < -250 ? 1.04 : 1
  return bandColour(metres).map((part) => Math.min(255, Math.round(part * shade)))
})

mkdirSync('public/map', { recursive: true })
writeFileSync('public/map/india-relief.png', relief)
console.log(
  `wrote public/map/india-relief.png (${PICTURE_WIDE} x ${PICTURE_HIGH}, ${Math.round(relief.length / 1024)} KB)`,
)

// ---------------------------------------------------------------------------
// Saving the heights for the app
// ---------------------------------------------------------------------------

// The app needs to look up the height at any pin. A picture file is a handy
// way to carry a big grid of numbers: here each pixel's RED value is a height
// code from 0 to 255 (green and blue are left at 0).
//   0        = sea (or anything at or below sea level)
//   1 to 255 = land; the height in metres is (code / HEIGHT_SCALE) squared.
// Squaring means low places are stored finely (to about 10 m) and the
// highest peaks more roughly (to about 40 m).
// The grid keeps every reading in the data: one about every 2.4 km.
const HEIGHT_SCALE = 2.7
const HEIGHTS_SHRINK = 1
const HEIGHTS_WIDE = Math.round(WIDTH * HEIGHTS_SHRINK)
const HEIGHTS_HIGH = Math.round(HEIGHT * HEIGHTS_SHRINK)

// Is this place in India, or within a few pixels of it? (The small margin
// keeps true heights right up to the border and the coast.)
function nearIndia(x, y) {
  for (let dy = -4; dy <= 4; dy += 2) {
    for (let dx = -4; dx <= 4; dx += 2) {
      const mx = Math.round((x + dx) * PICTURE_SCALE)
      const my = Math.round((y + dy) * PICTURE_SCALE)
      if (mx < 0 || my < 0 || mx >= PICTURE_WIDE || my >= PICTURE_HIGH) continue
      if (insideIndia[my * PICTURE_WIDE + mx]) return true
    }
  }
  return false
}

const heightsPicture = makePng(HEIGHTS_WIDE, HEIGHTS_HIGH, (px, py) => {
  const x = (px + 0.5) / HEIGHTS_SHRINK
  const y = (py + 0.5) / HEIGHTS_SHRINK
  const metres = heightAt(x, y)
  // Land outside India is stored as plain "1": pins cannot go there, and
  // leaving out its mountains makes the file much smaller.
  if (metres > 0 && !nearIndia(x, y)) return [1, 0, 0]
  const code =
    metres <= 0 ? 0 : Math.min(255, Math.max(1, Math.round(Math.sqrt(metres) * HEIGHT_SCALE)))
  return [code, 0, 0]
}, { smooth: true })
writeFileSync('public/map/india-heights.png', heightsPicture)
console.log(
  `wrote public/map/india-heights.png (${HEIGHTS_WIDE} x ${HEIGHTS_HIGH}, ${Math.round(heightsPicture.length / 1024)} KB)`,
)

// ---------------------------------------------------------------------------
// Writing the outlines
// ---------------------------------------------------------------------------

// Drops points that barely change a line's shape, so the outlines are small.
// (The Douglas-Peucker method: keep the point furthest from the straight
// line between the ends, if it is far enough, and repeat on both halves.)
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

// A ring starts and ends at the same point, which gives simplify() no
// straight line to measure from. So cut the ring in two at the point
// furthest from its start, simplify each half, and join them again.
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

// The area of a ring, used to drop specks too small to see.
function areaOf(ring) {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(sum) / 2
}

// Rings -> the text an SVG <path> understands ("M x y L x y ... Z").
function pathOf(rings, tolerance, smallest) {
  return rings
    .filter((ring) => areaOf(ring) >= smallest)
    .map((ring) => simplifyRing(ring, tolerance))
    .filter((ring) => ring.length >= 4)
    .map(
      (ring) =>
        'M' + ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z',
    )
    .join('')
}

// The box around a set of rings: used to zoom the map onto one state.
function boxOf(rings) {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      x1 = Math.min(x1, x)
      y1 = Math.min(y1, y)
      x2 = Math.max(x2, x)
      y2 = Math.max(y2, y)
    }
  }
  return [x1, y1, x2 - x1, y2 - y1].map((n) => Math.round(n * 10) / 10)
}

const NO_BORDER_LINE = ['Jammu and Kashmir', 'Ladakh']

// A short id for a state, e.g. "tamil-nadu".
function idOf(name) {
  return name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
}

const out = {
  // The size of the map's own grid. Paths, boxes and the picture all use it.
  width: Math.round(WIDTH * 10) / 10,
  height: Math.round(HEIGHT * 10) / 10,
  // The corners of the map on the Earth, for turning a tap into a place.
  west: WEST,
  east: EAST,
  north: NORTH,
  south: SOUTH,
  // How to read public/map/india-heights.png (see scripts/make-map.mjs).
  heightsWidth: HEIGHTS_WIDE,
  heightsHeight: HEIGHTS_HIGH,
  heightScale: HEIGHT_SCALE,
  // The key: each height band's colour and what it means.
  key: BANDS.map(([, colour, label]) => ({
    colour: '#' + colour.map((part) => part.toString(16).padStart(2, '0')).join(''),
    label,
  })),
  outline: pathOf(indiaRings, 0.6, 1.5),
  states: states.map((state) => ({
    id: idOf(state.name),
    name: state.name,
    box: boxOf(state.rings),
    // These two are drawn without their own border line. The state shapes in
    // the data follow lines of control, which differ from the country outline
    // used here; leaving the lines out keeps the map to one outer boundary.
    ...(NO_BORDER_LINE.includes(state.name) ? { noLine: true } : {}),
    path: pathOf(state.rings, 0.6, 1.5),
  })),
}

const source = `// THE MAP OF INDIA: outlines of the country and its states.
// MADE BY A SCRIPT - do not edit by hand. To change it, edit
// scripts/make-map.mjs and run:  npm run map
//
// The shapes come from Natural Earth (public domain). India's outer outline
// uses Natural Earth's "India point of view" file. See CREDITS.md.
//
// Every number is a position on the map's own grid, which is \`width\` wide
// and \`height\` tall. A \`path\` is a shape written the way SVG pictures
// expect; a \`box\` is [left, top, width, height] around a state.

export type MapState = {
  id: string
  name: string
  box: readonly [number, number, number, number]
  noLine?: boolean // true: drawn without its own border line
  path: string
}

export const INDIA_MAP: {
  width: number
  height: number
  west: number
  east: number
  north: number
  south: number
  heightsWidth: number
  heightsHeight: number
  heightScale: number
  key: readonly { colour: string; label: string }[]
  outline: string
  states: readonly MapState[]
} = ${JSON.stringify(out, null, 1)}
`
mkdirSync('src/map', { recursive: true })
writeFileSync('src/map/india.ts', source)
console.log(
  `wrote src/map/india.ts (${out.states.length} states, ${Math.round(source.length / 1024)} KB)`,
)
