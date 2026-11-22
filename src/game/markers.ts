// PIN MARKERS: how a pin looks on the map.
// Each pin shows either a small photo or one of eight icons, inside a round
// sticker. A pin with neither gets an icon picked from its terrain, so old
// pins (made before markers existed) still look right.
//
// The pictures for the icons are drawn in src/components/PinMarker.tsx.

import type { TerrainId } from './geo.ts'
import { MAX_PIN_PHOTO_CHARS } from './rules.ts'

export const MARKER_ICONS = [
  { id: 'heart', name: 'Heart' },
  { id: 'mountain', name: 'Mountain' },
  { id: 'beach', name: 'Beach' },
  { id: 'temple', name: 'Temple' },
  { id: 'city', name: 'City' },
  { id: 'food', name: 'Food' },
  { id: 'nature', name: 'Nature' },
  { id: 'star', name: 'Star' },
] as const

export type MarkerIconId = (typeof MARKER_ICONS)[number]['id']

export function isMarkerIcon(value: unknown): value is MarkerIconId {
  return MARKER_ICONS.some((icon) => icon.id === value)
}

// The icon a pin gets when the player didn't pick one.
export function iconForTerrain(terrain: TerrainId): MarkerIconId {
  switch (terrain) {
    case 'island':
    case 'coast':
      return 'beach'
    case 'plains':
      return 'city'
    case 'plateau':
    case 'hills':
      return 'nature'
    case 'mountains':
    case 'highMountains':
      return 'mountain'
  }
}

// The icon to draw for a pin: the one picked, or one from the terrain.
export function markerIconOf(pin: { icon?: MarkerIconId; terrain: TerrainId }): MarkerIconId {
  return pin.icon ?? iconForTerrain(pin.terrain)
}

// A pin photo is a small JPEG picture written out as text (a "data URL"),
// so it can live in the save. This checks one looks right and isn't too big.
export function isPinPhoto(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('data:image/jpeg;base64,') &&
    value.length <= MAX_PIN_PHOTO_CHARS
  )
}
