// THE QUEST LOG: all of today's dailies in one place, and where you edit
// your list of dailies. Challenges and epic quests will be added here.

import { useState } from 'react'
import { dailyStatuses } from '../game/dailies.ts'
import { REALMS } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import type { SaveData } from '../storage/save.ts'
import { DailyRow } from './DailyRow.tsx'
import { EditDailies } from './EditDailies.tsx'
import { PixelIcon } from './PixelIcon.tsx'

type Props = {
  save: SaveData
  now: Date
  onDaily: (dailyId: string) => void
  onAddDaily: (realm: RealmId, name: string, xp: number) => void
  onRenameDaily: (dailyId: string, name: string) => void
  onResizeDaily: (dailyId: string, xp: number) => void
  onRemoveDaily: (dailyId: string) => void
}

export function QuestLog({
  save,
  now,
  onDaily,
  onAddDaily,
  onRenameDaily,
  onResizeDaily,
  onRemoveDaily,
}: Props) {
  const [editing, setEditing] = useState(false)

  // Work out each realm's dailies once, then count how many are done.
  const groups = REALMS.map((realm) => ({
    realm,
    dailies: dailyStatuses(save, realm.id, now),
  }))
  const total = groups.reduce((sum, group) => sum + group.dailies.length, 0)
  const done = groups.reduce(
    (sum, group) => sum + group.dailies.filter((d) => d.doneToday).length,
    0,
  )

  return (
    <main className="screen quests">
      <header className="screen-header">
        <h1>Quest log</h1>
        <p className="screen-subtitle">
          {done} of {total} dailies done today
        </p>
      </header>

      <section className="panel">
        <div className="panel-top">
          <h2>{editing ? 'Edit dailies' : "Today's dailies"}</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <EditDailies
            save={save}
            onAdd={onAddDaily}
            onRename={onRenameDaily}
            onResize={onResizeDaily}
            onRemove={onRemoveDaily}
          />
        ) : (
          groups.map(({ realm, dailies }) => (
            <div key={realm.id} className="quest-group" data-realm={realm.id}>
              <h3 className="quest-group-name">
                <PixelIcon name={realm.id} size={24} />
                {realm.name}
              </h3>
              {dailies.map((daily) => (
                <DailyRow key={daily.id} daily={daily} onTick={onDaily} />
              ))}
            </div>
          ))
        )}
      </section>

      <section className="panel">
        <h2>Challenges and epic quests</h2>
        <p className="panel-text">
          Coming in the next updates. You will add your own here after each
          Game Master session.
        </p>
      </section>
    </main>
  )
}
