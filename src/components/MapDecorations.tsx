// THE MAP'S DECORATIONS, drawn on top of the terrain: trees, mountains,
// landmarks, and moving clouds, waves, boats and birds.
//
// Every picture here is our own drawing, made of simple shapes in the app's
// sticker style (flat colours, dark outlines). Each is drawn once, inside a
// 64 x 64 square, as an SVG "symbol"; the map then stamps a copy of it
// wherever it is needed with <use>.
//
// The pictures are sized from the view, like the town names, so they look
// the same size on screen at every zoom. They never catch a tap.

import { lonLatToGrid } from '../game/geo.ts'
import { DECORATION_SIZE, LANDMARK_SIZE } from '../game/rules.ts'
import type { MapView } from '../game/towns.ts'
import { LANDMARKS, MOUNTAIN_ART, MOVING, NATURE } from '../map/decorations.ts'
import type { Decoration } from '../map/decorations.ts'

const INK = '#1e1b2e'

// The drawings. Each <symbol> is one picture in a 64 x 64 square.
function Drawings() {
  return (
    <defs>
      <symbol id="deco-tree" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
          <rect x={29} y={38} width={6} height={16} rx={2} fill="#a0683c" />
          <circle cx={32} cy={28} r={16} fill="#3fa34d" />
          <circle cx={26} cy={23} r={4} fill="#6fcf6a" stroke="none" />
        </g>
      </symbol>

      <symbol id="deco-pine" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
          <rect x={29} y={46} width={6} height={10} fill="#a0683c" />
          <path d="M32 8 L46 30 H38 L50 48 H14 L26 30 H18 Z" fill="#2e8b57" />
        </g>
      </symbol>

      <symbol id="deco-palm" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
          {/* The trunk: a thick dark line with a thinner brown one on top. */}
          <path d="M33 56 C34 44 33 32 30 22" fill="none" strokeWidth={5} />
          <path d="M33 56 C34 44 33 32 30 22" fill="none" stroke="#b07a46" />
          <path
            d="M30 22 C22 14 12 16 8 24 C16 20 24 21 30 22 Z M30 22 C36 12 48 12 54 20 C46 18 38 19 30 22 Z M30 22 C30 12 22 6 16 8 C22 12 27 16 30 22 Z M30 22 C40 22 50 28 52 36 C44 30 36 26 30 22 Z"
            fill="#3fa34d"
          />
        </g>
      </symbol>

      <symbol id="deco-peaks" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
          <path d="M4 54 L24 18 L34 34 L42 24 L60 54 Z" fill="#9a7a66" />
          <path d="M24 18 L31 30 L27 28 L23 32 L19 27 Z" fill="#fff" />
          <path d="M42 24 L48 34 L44 33 L41 36 L37 32 Z" fill="#fff" />
        </g>
      </symbol>

      <symbol id="deco-summit-flag" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
          <path d="M6 56 L32 14 L58 56 Z" fill="#8f7a8a" />
          <path d="M32 14 L41 29 L36 27 L32 31 L27 27 L23 29 Z" fill="#fff" />
          {/* A little flag on the summit: you made it up here together. */}
          <path d="M32 14 V2" fill="none" />
          <path d="M32 3 L44 6.5 L32 10 Z" fill="#f5a8cf" />
        </g>
      </symbol>

      <symbol id="deco-dunes" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
          <path d="M2 50 C14 34 26 34 38 50 Z" fill="#f2c25a" />
          <path d="M26 52 C38 38 50 38 62 52 Z" fill="#e6a94a" />
          {/* A small cactus. */}
          <path
            d="M42 40 V24 M42 32 C37 32 36 28 36 26 M42 30 C47 30 48 26 48 24"
            fill="none"
            stroke="#2e8b57"
            strokeWidth={4}
          />
        </g>
      </symbol>

      <symbol id="deco-taj-mahal" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <rect x={6} y={50} width={52} height={6} fill="#f4efe6" />
          <rect x={18} y={32} width={28} height={18} fill="#fbf8f2" />
          <path d="M28 50 V40 C28 36 36 36 36 40 V50 Z" fill="#c9b9a6" />
          <path d="M20 32 C20 18 44 18 44 32 Z" fill="#fbf8f2" />
          <path d="M32 18 V12" />
          <rect x={8} y={24} width={4} height={26} fill="#fbf8f2" />
          <rect x={52} y={24} width={4} height={26} fill="#fbf8f2" />
          <circle cx={10} cy={22} r={3} fill="#fbf8f2" />
          <circle cx={54} cy={22} r={3} fill="#fbf8f2" />
        </g>
      </symbol>

      <symbol id="deco-india-gate" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M14 56 V18 H50 V56 H40 V34 C40 26 24 26 24 34 V56 Z" fill="#e8b48a" />
          <rect x={12} y={12} width={40} height={7} fill="#d99a6c" />
          <rect x={24} y={6} width={16} height={6} fill="#d99a6c" />
        </g>
      </symbol>

      <symbol id="deco-gateway-of-india" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M10 56 V26 H54 V56 H40 V40 C40 32 24 32 24 40 V56 Z" fill="#e9c98f" />
          <rect x={8} y={22} width={12} height={6} fill="#d9b070" />
          <rect x={44} y={22} width={12} height={6} fill="#d9b070" />
          <path
            d="M10 22 C10 14 18 14 18 22 Z M46 22 C46 14 54 14 54 22 Z M24 26 C24 16 40 16 40 26 Z"
            fill="#e9c98f"
          />
        </g>
      </symbol>

      <symbol id="deco-charminar" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <rect x={16} y={28} width={32} height={28} fill="#e7d3b5" />
          <path d="M26 56 V44 C26 38 38 38 38 44 V56 Z" fill="#b89c78" />
          <rect x={10} y={16} width={6} height={40} fill="#e7d3b5" />
          <rect x={48} y={16} width={6} height={40} fill="#e7d3b5" />
          <path d="M10 16 C10 10 16 10 16 16 Z M48 16 C48 10 54 10 54 16 Z" fill="#e7d3b5" />
        </g>
      </symbol>

      <symbol id="deco-hawa-mahal" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path
            d="M8 56 V40 H14 V30 H20 V20 H26 V12 H38 V20 H44 V30 H50 V40 H56 V56 Z"
            fill="#f0a090"
          />
          {/* Rows of little windows. */}
          <g fill="#c8665a" stroke="none">
            <rect x={12} y={44} width={4} height={5} />
            <rect x={20} y={44} width={4} height={5} />
            <rect x={30} y={44} width={4} height={5} />
            <rect x={40} y={44} width={4} height={5} />
            <rect x={48} y={44} width={4} height={5} />
            <rect x={18} y={33} width={4} height={4} />
            <rect x={30} y={33} width={4} height={4} />
            <rect x={42} y={33} width={4} height={4} />
            <rect x={24} y={23} width={4} height={4} />
            <rect x={36} y={23} width={4} height={4} />
            <rect x={30} y={15} width={4} height={4} />
          </g>
        </g>
      </symbol>

      <symbol id="deco-golden-temple" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <rect x={16} y={32} width={32} height={18} fill="#f2c94c" />
          <path d="M20 32 C20 18 44 18 44 32 Z" fill="#f7d96b" />
          <path d="M32 18 V12" />
          {/* The pool around it. */}
          <path d="M4 54 Q12 50 20 54 T36 54 T52 54 T64 54 V60 H4 Z" fill="#a8e2ef" />
        </g>
      </symbol>

      <symbol id="deco-meenakshi-temple" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M18 56 L24 10 H40 L46 56 Z" fill="#e9876a" />
          <path d="M23 18 H41 M22 26 H42 M21 34 H43 M20 42 H44 M19 50 H45" fill="none" />
          <path d="M26 10 C26 4 38 4 38 10 Z" fill="#f2c94c" />
        </g>
      </symbol>

      <symbol id="deco-victoria-memorial" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <rect x={8} y={40} width={48} height={14} fill="#fbf8f2" />
          <path d="M20 40 C20 22 44 22 44 40 Z" fill="#fbf8f2" />
          <path d="M32 22 V14" />
          <circle cx={32} cy={12} r={2.5} fill="#2b2b2b" />
          <path d="M4 56 H60" strokeWidth={3} />
        </g>
      </symbol>

      <symbol id="deco-cloud" viewBox="0 0 64 64">
        <path
          d="M14 40 C6 40 6 30 14 30 C14 22 26 20 28 28 C32 20 46 22 44 30 C52 30 52 40 44 40 Z"
          fill="#fff"
          stroke={INK}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </symbol>

      <symbol id="deco-wave" viewBox="0 0 64 64">
        <g fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round">
          <path d="M10 30 q5 -5 10 0 t10 0" />
          <path d="M30 44 q5 -5 10 0 t10 0" />
        </g>
      </symbol>

      <symbol id="deco-boat" viewBox="0 0 64 64">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M12 40 H52 L46 50 H18 Z" fill="#c0703c" />
          <path d="M32 40 V12" />
          <path d="M33 14 L50 36 H33 Z" fill="#fff" />
          <path d="M31 18 L18 36 H31 Z" fill="#f5a8cf" />
        </g>
      </symbol>

      <symbol id="deco-birds" viewBox="0 0 64 64">
        <g fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round">
          <path d="M8 30 q6 -7 12 0 q6 -7 12 0" />
          <path d="M34 42 q5 -6 10 0 q5 -6 10 0" />
        </g>
      </symbol>
    </defs>
  )
}

// One decoration. Nature and landmarks stand on their spot (the bottom
// middle of the picture is on the place); moving bits are centred on it.
//
// The outer group moves the 64 x 64 drawing into place and scales it. The
// inner group is what the animations in index.css move, in the drawing's own
// 64 x 64 units, so a cloud drifts the same distance on screen at any zoom.
function Stamp({
  decoration,
  size,
  index,
}: {
  decoration: Decoration
  size: number
  index: number
}) {
  const [x, y] = lonLatToGrid(decoration.lon, decoration.lat)
  // Clouds are drawn bigger than the rest.
  if (decoration.kind === 'cloud') size *= 1.6
  const stands = !['cloud', 'wave', 'boat', 'birds'].includes(decoration.kind)
  const left = x - size / 2
  const top = stands ? y - size : y - size / 2
  return (
    <g transform={`translate(${left} ${top}) scale(${size / 64})`}>
      <g
        className={`map-deco map-deco-${decoration.kind}`}
        // Start each one at a different point, so they don't all move together.
        style={{ animationDelay: `${-index * 0.7}s` }}
      >
        <use href={`#deco-${decoration.kind}`} width={64} height={64} />
      </g>
    </g>
  )
}

// `mountainArt` adds the mountain region art, unlocked by the
// "3 mountain destinations" map milestone.
export function MapDecorations({ view, mountainArt }: { view: MapView; mountainArt: boolean }) {
  const size = view.width * DECORATION_SIZE
  const landmarkSize = view.width * LANDMARK_SIZE
  return (
    <g className="map-decorations" aria-hidden="true">
      <Drawings />
      {/* Sea things first, so the land things are drawn over them. */}
      {MOVING.filter((d) => d.kind !== 'birds').map((decoration, index) => (
        <Stamp key={`m${index}`} decoration={decoration} size={size} index={index} />
      ))}
      {NATURE.map((decoration, index) => (
        <Stamp key={`n${index}`} decoration={decoration} size={size} index={index} />
      ))}
      {mountainArt &&
        MOUNTAIN_ART.map((decoration, index) => (
          <Stamp key={`a${index}`} decoration={decoration} size={size} index={index} />
        ))}
      {LANDMARKS.map((decoration, index) => (
        <Stamp key={`l${index}`} decoration={decoration} size={landmarkSize} index={index} />
      ))}
      {MOVING.filter((d) => d.kind === 'birds').map((decoration, index) => (
        <Stamp key={`b${index}`} decoration={decoration} size={size} index={index} />
      ))}
    </g>
  )
}
