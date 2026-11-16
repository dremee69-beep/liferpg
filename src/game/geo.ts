// MAP MATHS
// Turning a tap on the map into a place: which state it is in, where it is
// on the Earth, and what kind of terrain it is.
//
// Positions come in two kinds:
//   - "grid" positions [x, y]: where something is on the map's own grid
//     (INDIA_MAP.width wide, INDIA_MAP.height tall), the same grid the
//     outlines are drawn on;
//   - longitude and latitude: where it is on the Earth. Pins are saved this
//     way, so they would still be right if the map picture ever changed.

import { INDIA_MAP } from '../map/india.ts'
import { MOUNTAIN_METRES } from './rules.ts'

export type GridPoint = readonly [number, number]

// ---------------------------------------------------------------------------
// Grid <-> longitude and latitude
// ---------------------------------------------------------------------------
// The map uses the "Web Mercator" projection, the usual one for maps on the
// web: longitude spreads evenly left to right, and latitude is stretched a
// little more the further north you go.

// How far up the flattened Earth a latitude sits (no units; only differences
// between two of these matter).
function mercator(lat: number): number {
  return Math.asinh(Math.tan((lat * Math.PI) / 180))
}

const TOP = mercator(INDIA_MAP.north)
const BOTTOM = mercator(INDIA_MAP.south)

export function lonLatToGrid(lon: number, lat: number): GridPoint {
  const x =
    ((lon - INDIA_MAP.west) / (INDIA_MAP.east - INDIA_MAP.west)) * INDIA_MAP.width
  const y = ((TOP - mercator(lat)) / (TOP - BOTTOM)) * INDIA_MAP.height
  return [x, y]
}

export function gridToLonLat([x, y]: GridPoint): { lon: number; lat: number } {
  const lon =
    INDIA_MAP.west + (x / INDIA_MAP.width) * (INDIA_MAP.east - INDIA_MAP.west)
  const m = TOP - (y / INDIA_MAP.height) * (TOP - BOTTOM)
  const lat = (Math.atan(Math.sinh(m)) * 180) / Math.PI
  return { lon, lat }
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

// A ring is a closed loop of grid points; a shape is one or more rings.
type Ring = GridPoint[]

// Reads the outline text from src/map/india.ts ("M x yL x y...Z") back into
// rings of points.
function ringsFromPath(path: string): Ring[] {
  return path
    .split('Z')
    .filter((part) => part !== '')
    .map((part) =>
      part
        .slice(1) // drop the leading "M"
        .split('L')
        .map((pair): GridPoint => {
          const [x, y] = pair.split(' ').map(Number)
          return [x, y]
        }),
    )
}

// Reading the shapes takes a moment, so it is done once, the first time
// they are needed, and remembered.
let shapes: { india: Ring[]; states: { id: string; name: string; rings: Ring[] }[] } | null =
  null
function getShapes() {
  if (shapes === null) {
    shapes = {
      india: ringsFromPath(INDIA_MAP.outline),
      states: INDIA_MAP.states.map((state) => ({
        id: state.id,
        name: state.name,
        rings: ringsFromPath(state.path),
      })),
    }
  }
  return shapes
}

// Is the point inside the shape? (Counts how many edges a line running to
// the right from the point crosses: an odd number means inside.)
function isInside(rings: Ring[], [x, y]: GridPoint): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside
      }
    }
  }
  return inside
}

// How far the point is from the nearest edge of the shape, in grid units.
function distanceTo(rings: Ring[], [x, y]: GridPoint): number {
  let best = Infinity
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j]
      const [bx, by] = ring[i]
      const dx = bx - ax
      const dy = by - ay
      const lengthSquared = dx * dx + dy * dy
      // How far along the edge the nearest point is, kept between its ends.
      const along =
        lengthSquared === 0
          ? 0
          : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared))
      best = Math.min(best, Math.hypot(x - (ax + along * dx), y - (ay + along * dy)))
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Which state is this?
// ---------------------------------------------------------------------------

export type PlaceState = { id: string; name: string }

// The state or union territory a grid point is in, or null when the point
// is outside India's outline.
//
// A point inside India's outline but outside every state shape still gets a
// state: the nearest one. That happens along coasts (the state shapes are a
// little rougher than the outline) and in the far north, where the state
// shapes in the data stop short of the outline.
export function stateAt(point: GridPoint): PlaceState | null {
  const { india, states } = getShapes()

  for (const state of states) {
    if (isInside(state.rings, point)) return { id: state.id, name: state.name }
  }
  if (!isInside(india, point)) return null

  let nearest = states[0]
  let nearestDistance = Infinity
  for (const state of states) {
    const distance = distanceTo(state.rings, point)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = state
    }
  }
  return { id: nearest.id, name: nearest.name }
}

// ---------------------------------------------------------------------------
// Heights and terrain
// ---------------------------------------------------------------------------

// The height grid stores each height as a code from 0 to 255 (see
// scripts/make-map.mjs). 0 is the sea; otherwise this gives the metres.
export function metresFromCode(code: number): number {
  if (code <= 0) return 0
  return Math.round((code / INDIA_MAP.heightScale) ** 2)
}

// Rounds a height for showing: to the nearest 10 m, since the grid is not
// more exact than that. e.g. 2047 -> "about 2,050 m".
export function describeHeight(metres: number): string {
  const rounded = Math.round(metres / 10) * 10
  return `about ${rounded.toLocaleString('en-IN')} m`
}

export const TERRAIN_TYPES = [
  { id: 'island', name: 'Island' },
  { id: 'coast', name: 'Coast' },
  { id: 'plains', name: 'Plains' },
  { id: 'plateau', name: 'Plateau' },
  { id: 'hills', name: 'Hills' },
  { id: 'mountains', name: 'Mountains' },
  { id: 'highMountains', name: 'High mountains' },
] as const

export type TerrainId = (typeof TERRAIN_TYPES)[number]['id']

export function terrainName(id: TerrainId): string {
  return TERRAIN_TYPES.find((terrain) => terrain.id === id)?.name ?? ''
}

// The two island territories.
const ISLAND_STATES = ['andaman-and-nicobar', 'lakshadweep']

// What kind of terrain a place is, from its height and surroundings.
// `nearSea` means the sea is within about 10 km.
export function terrainFor(place: {
  metres: number
  nearSea: boolean
  stateId: string
}): TerrainId {
  if (ISLAND_STATES.includes(place.stateId)) return 'island'
  if (place.metres < 100 && place.nearSea) return 'coast'
  if (place.metres < 300) return 'plains'
  if (place.metres < 800) return 'plateau'
  if (place.metres < MOUNTAIN_METRES) return 'hills'
  if (place.metres < 3500) return 'mountains'
  return 'highMountains'
}

// A "mountain destination" is any place at or above MOUNTAIN_METRES.
export function isMountainHeight(metres: number): boolean {
  return metres >= MOUNTAIN_METRES
}
