// FIRST LAUNCH SCREEN: "Who is playing on this phone?"
// Shown only when there is no save on the device yet.

import { PLAYERS } from '../game/rules.ts'
import type { PlayerId } from '../game/rules.ts'

type Props = {
  // App.tsx tells us what to do when a player is chosen.
  onPick: (player: PlayerId) => void
}

export function PlayerPicker({ onPick }: Props) {
  return (
    <main className="screen picker">
      <h1>LifeRPG</h1>
      <p className="picker-question">Who is playing on this phone?</p>

      <div className="picker-buttons">
        {PLAYERS.map((player) => (
          <button
            key={player.id}
            type="button"
            className="button button-big"
            onClick={() => onPick(player.id)}
          >
            {player.name}
          </button>
        ))}
      </div>

      <p className="hint">Your progress is saved on this device only.</p>
    </main>
  )
}
