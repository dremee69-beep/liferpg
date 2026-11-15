// DRAWS ONE PIXEL ICON from the letter grids in src/art/icons.ts.
// It builds a tiny picture out of coloured rectangles (an SVG), which stays
// perfectly sharp at any size. Sizes that are multiples of 12 look best.

import type { ReactElement } from 'react'
import { ICON_COLOURS, ICON_SIZE, ICONS } from '../art/icons.ts'
import type { IconName } from '../art/icons.ts'

type Props = {
  name: IconName
  size?: number // width and height on screen, in pixels
}

export function PixelIcon({ name, size = 24 }: Props) {
  // A list of drawn rectangles (ReactElement = one piece of screen).
  const rectangles: ReactElement[] = []

  ICONS[name].forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const letter = row[x]
      // Neighbours of the same colour are drawn as one wider rectangle.
      let run = 1
      while (x + run < row.length && row[x + run] === letter) run++

      if (letter !== '.') {
        rectangles.push(
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={run}
            height={1}
            fill={ICON_COLOURS[letter]}
          />,
        )
      }
      x += run
    }
  })

  return (
    <svg
      className="pixel-icon"
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      // "crispEdges" keeps the pixels hard-edged instead of blurry.
      shapeRendering="crispEdges"
      // Icons are decoration; the words next to them say the same thing.
      aria-hidden="true"
    >
      {rectangles}
    </svg>
  )
}
