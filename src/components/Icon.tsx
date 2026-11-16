// DRAWS ONE ICON from the outlines in src/art/line-icons.ts.
// Icons are drawn as lines (an SVG), so they stay sharp at any size.
//
// Colours come from the CSS around the icon:
//   - the outline uses the text colour;
//   - filled shapes use --icon-fill (white unless the CSS says otherwise).

import { LINE_ICONS } from '../art/line-icons.ts'
import type { IconName, IconPath } from '../art/line-icons.ts'

type Props = {
  name: IconName
  size?: number // width and height on screen, in pixels
}

export function Icon({ name, size = 24 }: Props) {
  const paths: readonly IconPath[] = LINE_ICONS[name]

  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      // Icons are decoration; the words next to them say the same thing.
      aria-hidden="true"
    >
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill={path.fill ? 'var(--icon-fill, #fff)' : 'none'}
        />
      ))}
    </svg>
  )
}
