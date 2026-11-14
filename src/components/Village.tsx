// THE VILLAGE (home screen): who you are, your player level, and the five
// realm cards with their log buttons.

import { isDailyDoneToday } from '../game/actions.ts'
import { PLAYERS, REALMS } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import { playerLevel } from '../game/xp.ts'
import type { SaveData } from '../storage/save.ts'
import { ActivityLog } from './ActivityLog.tsx'
import { RealmCard } from './RealmCard.tsx'

type Props = {
  save: SaveData
  now: Date // the current time, used to decide what counts as "today"
  onLog: (realm: RealmId, xp: number) => void
  onDaily: (dailyId: string) => void
  onRemoveEntry: (index: number) => void
  onOpenCamp: () => void
}

export function Village({
  save,
  now,
  onLog,
  onDaily,
  onRemoveEntry,
  onOpenCamp,
}: Props) {
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
          // This realm's dailies, each marked done or not done today.
          dailies={save.dailies
            .filter((daily) => daily.realm === realm.id)
            .map((daily) => ({
              id: daily.id,
              name: daily.name,
              doneToday: isDailyDoneToday(save, daily.id, now),
            }))}
          onLog={onLog}
          onDaily={onDaily}
        />
      ))}

      <ActivityLog save={save} now={now} onRemove={onRemoveEntry} />

      <button type="button" className="button button-wide" onClick={onOpenCamp}>
        Camp: back up or restore your save
      </button>
    </main>
  )
}
