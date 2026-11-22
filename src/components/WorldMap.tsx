// THE WORLD MAP: every country as a simple cartoon shape, for pins abroad.
//
// Countries you have visited together (a confirmed pin there) are painted
// green; India is gold, and tapping it takes you back to the India map. The
// pins are the same sticker markers as on the India map.
//
// This is only the picture. What a tap does is decided by MapScreen.

import type { MouseEvent } from 'react'
import { worldLonLatToGrid } from '../game/world.ts'
import { PIN_MARKER_SIZE } from '../game/rules.ts'
import type { GridPoint } from '../game/geo.ts'
import type { MapView } from '../game/towns.ts'
import type { WorldCountry } from '../map/world.ts'
import type { Pin } from '../storage/save.ts'
import { MarkerIconDrawings, PinMarker } from './PinMarker.tsx'

export type WorldData = {
  width: number
  height: number
  north: number
  south: number
  countries: readonly WorldCountry[]
}

type Props = {
  world: WorldData
  view: MapView
  pins: Pin[] // the pins to draw (declined ones already left out)
  player: string // this phone's player, so their own pins show photos
  visited: ReadonlySet<string> // ids of countries visited together
  selectedId: string | null // the country zoomed in on
  spot: GridPoint | null // the spot being pinned right now
  placing: boolean
  onTap: (event: MouseEvent<SVGSVGElement>) => void
}

export function WorldMap({
  world,
  view,
  pins,
  player,
  visited,
  selectedId,
  spot,
  placing,
  onTap,
}: Props) {
  return (
    <svg
      className={placing ? 'map map-world map-placing' : 'map map-world'}
      viewBox={`${view.left} ${view.top} ${view.width} ${view.height}`}
      role="img"
      aria-label="World map"
      onClick={onTap}
    >
      {world.countries.map((country) => (
        <path
          key={country.id}
          d={country.path}
          className={
            'world-country' +
            (country.id === 'in' ? ' world-country-india' : '') +
            (visited.has(country.id) ? ' world-country-visited' : '') +
            (country.id === selectedId ? ' world-country-selected' : '')
          }
        />
      ))}

      {/* The pins, northern ones first so southern markers sit in front. */}
      <g className="map-pins">
        <MarkerIconDrawings />
        {[...pins]
          .sort((a, b) => b.lat - a.lat)
          .map((pin) => {
            const [x, y] = worldLonLatToGrid(world, pin.lon, pin.lat)
            return (
              <PinMarker
                key={pin.id}
                pin={pin}
                mine={pin.by === player}
                x={x}
                y={y}
                size={view.width * PIN_MARKER_SIZE}
              />
            )
          })}
      </g>

      {spot !== null && (
        <g>
          <path d={`M${spot[0]} ${spot[1]}h0.01`} className="map-pin-edge map-pin-edge-new" />
          <path d={`M${spot[0]} ${spot[1]}h0.01`} className="map-pin map-pin-new" />
        </g>
      )}
    </svg>
  )
}
