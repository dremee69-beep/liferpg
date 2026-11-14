// THE VILLAGE (home screen): who you are, your player level, and the five
// realm cards with their log buttons.

import { PLAYERS, REALMS } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import { playerLevel } from '../game/xp.ts'
import type { SaveData } from '../storage/save.ts'
import { RealmCard } from './RealmCard.tsx'

type Props = {
  save: SaveData
  onLog: (realm: RealmId, xp: number) => void
}

export function Village({ save, onLog }: Props) {
  // Look up the display name for the saved player id.
  const player = PLAYERS.find((p) => p.id === save.player)

  return (
    <main className="screen village">
      <header className="village-header">
        <div>
          <p className="village-label">Village</p>
          <h1>{player?.name}</h1>
        </div>
        <div className="player-level">
          <span className="player-level-label">Player level</span>
          <span className="player-level-number">{playerLevel(save.realmXp)}</span>
        </div>
      </header>

      {REALMS.map((realm) => (
        <RealmCard
          key={realm.id}
          realm={realm}
          xp={save.realmXp[realm.id]}
          onLog={onLog}
        />
      ))}
    </main>
  )
}
