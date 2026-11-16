// A CELEBRATION CARD: appears in the middle of the screen for a level-up or
// a finished challenge tier, with the realm's icon and a burst of pixel
// sparkles. It closes by itself, or straight away if you tap it. Taps anywhere
// else pass through to the app underneath, so it never gets in the way.

import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { RealmId } from '../game/rules.ts'
import { PixelIcon } from './PixelIcon.tsx'

type Props = {
  realm: RealmId // decides the icon and the colour
  title: string // the big line, e.g. "Level up!"
  children: ReactNode // the smaller lines underneath
  onClose: () => void
}

// How long the card stays up, in milliseconds.
const SHOW_MS = 2800

// The sparkles: each flies out from the centre in its own direction.
// x and y are how far it travels, in pixels.
const SPARKLES = [
  { x: -110, y: -70 },
  { x: -60, y: -120 },
  { x: 0, y: -135 },
  { x: 60, y: -120 },
  { x: 110, y: -70 },
  { x: -125, y: 10 },
  { x: 125, y: 10 },
  { x: -85, y: 80 },
  { x: 85, y: 80 },
  { x: 0, y: 105 },
]

export function CelebrationCard({ realm, title, children, onClose }: Props) {
  // Close by itself after a short while.
  useEffect(() => {
    const timer = setTimeout(onClose, SHOW_MS)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    // The wrapper covers the screen but lets taps through; only the card
    // itself can be tapped.
    <div className="celebration-layer" data-realm={realm}>
      <button type="button" className="celebration-card" onClick={onClose}>
        <span className="celebration-sparkles" aria-hidden="true">
          {SPARKLES.map((sparkle, index) => (
            <span
              key={index}
              className="sparkle"
              style={
                // Hand each sparkle its own direction and a slightly
                // different start time; the CSS animation reads these.
                // ("as CSSProperties" tells TypeScript our own --names are OK.)
                {
                  '--fly-x': `${sparkle.x}px`,
                  '--fly-y': `${sparkle.y}px`,
                  animationDelay: `${(index % 4) * 60}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>

        <span className="celebration-icon">
          <PixelIcon name={realm} size={72} />
        </span>
        <span className="celebration-title">{title}</span>
        {children}
      </button>
    </div>
  )
}
