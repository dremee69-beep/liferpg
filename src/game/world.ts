// WORLD MAP MATHS: the same jobs geo.ts does for India, for the world map.
// Turning a tap into a place (which country, where on the Earth), and
// placing pins abroad on the world map.
//
// The world map's outlines (src/map/world.ts) are big, so the Map screen
// only loads them when the World view is opened. That is why these
// functions are handed the map instead of importing it.

import { distanceTo, isInside, ringsFromPath } from './geo.ts'
import type { GridPoint, Ring } from './geo.ts'
import type { Pin } from '../storage/save.ts'
import type { WorldCountry } from '../map/world.ts'

// The parts of the world map these functions need.
export type WorldGrid = {
  width: number
  height: number
  north: number
  south: number
}

function mercator(lat: number): number {
  return Math.asinh(Math.tan((lat * Math.PI) / 180))
}

export function worldLonLatToGrid(map: WorldGrid, lon: number, lat: number): GridPoint {
  const top = mercator(map.north)
  const bottom = mercator(map.south)
  const clamped = Math.max(map.south, Math.min(map.north, lat))
  const x = ((lon + 180) / 360) * map.width
  const y = ((top - mercator(clamped)) / (top - bottom)) * map.height
  return [x, y]
}

export function worldGridToLonLat(map: WorldGrid, [x, y]: GridPoint): { lon: number; lat: number } {
  const top = mercator(map.north)
  const bottom = mercator(map.south)
  const lon = (x / map.width) * 360 - 180
  const m = top - (y / map.height) * (top - bottom)
  const lat = (Math.atan(Math.sinh(m)) * 180) / Math.PI
  return { lon, lat }
}

// The stateId a pin abroad is saved with: "abroad-" and the country's code.
// (Inside India it is the state's id; see mapMilestones.ts isAbroadPin.)
export function abroadStateId(countryId: string): string {
  return `abroad-${countryId}`
}

// Reading every country's outline takes a moment, so it is done once.
let shapes: { id: string; name: string; rings: Ring[] }[] | null = null

// How close to a coast a tap in the sea may be and still count as that
// country, in world-map units (1 unit is about 40 km at the equator). The
// outlines are simplified, so a seaside town can sit just "off" its coast.
export const COAST_REACH = 1

// The country a world-map point is in, or null for the open sea. A point in
// the sea but within COAST_REACH of a coast counts as the nearest country.
export function countryAt(
  countries: readonly WorldCountry[],
  point: GridPoint,
): { id: string; name: string } | null {
  if (shapes === null) {
    shapes = countries.map((country) => ({
      id: country.id,
      name: country.name,
      rings: ringsFromPath(country.path),
    }))
  }
  for (const shape of shapes) {
    if (isInside(shape.rings, point)) return { id: shape.id, name: shape.name }
  }
  let nearest: { id: string; name: string } | null = null
  let nearestDistance = COAST_REACH
  for (const shape of shapes) {
    const distance = distanceTo(shape.rings, point)
    if (distance <= nearestDistance) {
      nearest = { id: shape.id, name: shape.name }
      nearestDistance = distance
    }
  }
  return nearest
}

// Where a pin goes on the world map. Every pin shows there, in India too.
export function worldPointOfPin(map: WorldGrid, pin: Pin): GridPoint {
  return worldLonLatToGrid(map, pin.lon, pin.lat)
}
