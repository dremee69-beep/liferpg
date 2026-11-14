// FIRST LAUNCH SCREEN: "Who is playing on this phone?"
// Shown only when there is no save on the device yet.

import { PLAYERS } from '../game/rules.ts'
import type { PlayerId } from '../game/rules.ts'
import type { SaveData } from '../storage/save.ts'
import { ImportSave } from './ImportSave.tsx'

type Props = {
  // App.tsx tells us what to do when a player is chosen.
  onPick: (player: PlayerId) => void
  // ...and when a backup file is brought in instead (e.g. on a new phone).
  onImport: (save: SaveData) => void
}

export function PlayerPicker({ onPick, onImport }: Props) {
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

      <div className="picker-import">
        <p className="hint">Already played on another phone?</p>
        <ImportSave hasExistingSave={false} onImport={onImport} />
      </div>
    </main>
  )
}
