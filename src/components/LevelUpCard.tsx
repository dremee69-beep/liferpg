// THE LEVEL-UP MOMENT: a card in the middle of the screen with the realm's
// icon, the new level and a burst of pixel sparkles. It closes by itself, or
// straight away if you tap it. Taps anywhere else pass through to the app
// underneath, so it never gets in the way of logging.

import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { REALMS } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import { PixelIcon } from './PixelIcon.tsx'

type Props = {
  realm: RealmId
  level: number // the realm's new level
  playerLevel: number // the player's new overall level
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

export function LevelUpCard({ realm, level, playerLevel, onClose }: Props) {
  // Close by itself after a short while.
  useEffect(() => {
    const timer = setTimeout(onClose, SHOW_MS)
    return () => clearTimeout(timer)
  }, [onClose])

  const realmName = REALMS.find((r) => r.id === realm)?.name

  return (
    // The wrapper covers the screen but lets taps through; only the card
    // itself can be tapped.
    <div className="levelup-layer" data-realm={realm}>
      <button
        type="button"
        className="levelup-card"
        onClick={onClose}
        aria-label={`Level up. ${realmName} reached level ${level}. Tap to close.`}
      >
        <span className="levelup-sparkles" aria-hidden="true">
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

        <span className="levelup-icon">
          <PixelIcon name={realm} size={72} />
        </span>
        <span className="levelup-title">Level up!</span>
        <span className="levelup-realm">
          {realmName} reached <strong>level {level}</strong>
        </span>
        <span className="levelup-player">Player level {playerLevel}</span>
      </button>
    </div>
  )
}
