// PIN MARKERS: the round stickers that show the pins on the map.
//
// A marker is a white circle with a dark edge and a small tail pointing at
// the exact spot. Inside is the pin's photo, or one of eight icons drawn
// here (our own drawings, in the app's sticker style). A bucket-list pin
// gets a gold ring; a pin your partner dropped gets a purple ring and only
// ever shows its icon, because photos stay on the phone that took them.
//
// Each icon is drawn once as an SVG "symbol" in a 48 x 48 square; markers
// stamp copies of it with <use>.

import { markerIconOf } from '../game/markers.ts'
import type { MarkerIconId } from '../game/markers.ts'
import type { Pin } from '../storage/save.ts'

const INK = '#1e1b2e'
const BUCKET_GOLD = '#ffd166'
const PARTNER_PURPLE = '#7f77dd'

// The drawings of the eight icons. Put this once inside any <svg> that uses
// the icons (the map, and each button of the icon picker).
export function MarkerIconDrawings() {
  return (
    <defs>
      <symbol id="pin-icon-heart" viewBox="0 0 48 48">
        <path
          d="M24 36 C8 25 12 10 24 17 C36 10 40 25 24 36 Z"
          fill="#f5a8cf"
          stroke={INK}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </symbol>

      <symbol id="pin-icon-mountain" viewBox="0 0 48 48">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
          <path d="M8 34 L20 13 L27 25 L31 19 L40 34 Z" fill="#9a7a66" />
          <path d="M20 13 L24 20 L21 19 L18 21 L16 20 Z" fill="#fff" />
        </g>
      </symbol>

      <symbol id="pin-icon-beach" viewBox="0 0 48 48">
        <path d="M7 35 H41" stroke="#40aad6" strokeWidth={5} strokeLinecap="round" />
        <g fill="none" strokeLinecap="round">
          <path d="M25 33 C26 26 25 21 23 16" stroke={INK} strokeWidth={3} />
          <path
            d="M23 16 C18 11 12 13 10 18 M23 16 C27 10 33 11 36 16 M23 16 C28 16 33 20 33 25"
            stroke="#3fa34d"
            strokeWidth={3.5}
          />
        </g>
      </symbol>

      <symbol id="pin-icon-temple" viewBox="0 0 48 48">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
          <path d="M14 36 L18 12 H30 L34 36 Z" fill="#e9876a" />
          <path d="M17 20 H31 M16 28 H32" fill="none" strokeWidth={1.8} />
          <path d="M20 12 C20 7 28 7 28 12 Z" fill="#f2c94c" />
        </g>
      </symbol>

      <symbol id="pin-icon-city" viewBox="0 0 48 48">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
          <rect x={10} y={19} width={10} height={17} fill="#cecbf6" />
          <rect x={20} y={11} width={10} height={25} fill="#afa9ec" />
          <rect x={30} y={23} width={8} height={13} fill="#cecbf6" />
        </g>
      </symbol>

      <symbol id="pin-icon-food" viewBox="0 0 48 48">
        <g stroke={INK} strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M9 24 H39 C39 32 33 37 24 37 C15 37 9 32 9 24 Z"
            fill="#f2c94c"
            strokeWidth={2.5}
          />
          {/* Steam rising from the bowl. */}
          <path
            d="M18 19 q2 -4 0 -8 M24 19 q2 -4 0 -8 M30 19 q2 -4 0 -8"
            fill="none"
            strokeWidth={2}
          />
        </g>
      </symbol>

      <symbol id="pin-icon-nature" viewBox="0 0 48 48">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
          {/* A leaf with its middle vein. */}
          <path d="M11 37 C10 20 22 11 38 11 C38 28 28 38 11 37 Z" fill="#3fa34d" />
          <path d="M11 37 L30 19" fill="none" />
        </g>
      </symbol>

      <symbol id="pin-icon-star" viewBox="0 0 48 48">
        <path
          d="M24 9 L28.5 19.5 L39 20 L31 27.5 L33.5 38 L24 32 L14.5 38 L17 27.5 L9 20 L19.5 19.5 Z"
          fill="#ffd166"
          stroke={INK}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </symbol>

      {/* Cuts a photo to a circle. "objectBoundingBox" means the numbers
          are shares of the photo's own size, so it fits any photo. */}
      <clipPath id="pin-photo-clip" clipPathUnits="objectBoundingBox">
        <circle cx={0.5} cy={0.5} r={0.5} />
      </clipPath>
    </defs>
  )
}

// One marker, drawn in its own 48 x 60 square: the circle's middle is at
// (24, 24) and the tail's tip, which points at the spot, is at (24, 58).
function MarkerShape({
  icon,
  photo,
  ring,
}: {
  icon: MarkerIconId
  photo: string | null
  ring: string | null
}) {
  return (
    <>
      <path d="M24 58 L15 40 H33 Z" fill={INK} />
      <circle cx={24} cy={24} r={22} fill={INK} />
      <circle cx={24} cy={24} r={19} fill="#fff" />
      {photo !== null ? (
        <image
          href={photo}
          x={7}
          y={7}
          width={34}
          height={34}
          clipPath="url(#pin-photo-clip)"
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <use href={`#pin-icon-${icon}`} x={4} y={4} width={40} height={40} />
      )}
      {ring !== null && (
        <circle cx={24} cy={24} r={18.5} fill="none" stroke={ring} strokeWidth={4} />
      )}
    </>
  )
}

// A pin's marker on the map. `size` is how wide it is in map units; the tail
// tip lands on (x, y).
export function PinMarker({
  pin,
  mine,
  x,
  y,
  size,
}: {
  pin: Pin
  mine: boolean // true if this phone's player dropped the pin
  x: number
  y: number
  size: number
}) {
  const scale = size / 48
  // Partner pins: icon only, purple ring. Own pins: photo if there is one,
  // and a gold ring for the bucket list.
  const photo = mine ? (pin.photo ?? null) : null
  const ring = !mine ? PARTNER_PURPLE : pin.bucketList ? BUCKET_GOLD : null
  return (
    <g transform={`translate(${x - 24 * scale} ${y - 58 * scale}) scale(${scale})`}>
      <MarkerShape icon={markerIconOf(pin)} photo={photo} ring={ring} />
    </g>
  )
}

// A marker on its own, as a small picture: used in the pin list and in the
// pin form, so you can see what the pin will look like on the map.
export function MarkerPreview({
  icon,
  photo,
  bucketList,
  size = 40,
}: {
  icon: MarkerIconId
  photo: string | null
  bucketList: boolean
  size?: number
}) {
  return (
    <svg
      className="marker-preview"
      width={size}
      height={(size * 60) / 48}
      viewBox="0 0 48 60"
      aria-hidden="true"
    >
      <MarkerIconDrawings />
      <MarkerShape icon={icon} photo={photo} ring={bucketList ? BUCKET_GOLD : null} />
    </svg>
  )
}

// Just one icon, as a small picture (for the buttons of the icon picker).
export function MarkerIconPicture({ icon, size = 32 }: { icon: MarkerIconId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <MarkerIconDrawings />
      <use href={`#pin-icon-${icon}`} width={48} height={48} />
    </svg>
  )
}
