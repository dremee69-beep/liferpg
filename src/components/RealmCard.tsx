// ONE REALM CARD: name, level, XP bar, today's daily quests, and the two
// one-tap log buttons for anything else.

import type { DailyStatus } from '../game/dailies.ts'
import { XP_BIG, XP_SMALL } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import { levelProgress } from '../game/xp.ts'
import { DailyRow } from './DailyRow.tsx'

type Props = {
  realm: { id: RealmId; name: string; covers: string }
  xp: number // total XP in this realm
  dailies: DailyStatus[]
  onLog: (realm: RealmId, xp: number) => void
  onDaily: (dailyId: string) => void
}

export function RealmCard({ realm, xp, dailies, onLog, onDaily }: Props) {
  const progress = levelProgress(xp)
  // How full the bar is, as a percentage from 0 to 100.
  const percent = (progress.xpIntoLevel / progress.xpForThisLevel) * 100

  return (
    // data-realm lets the CSS give each realm its own colour.
    <section className="realm" data-realm={realm.id}>
      <div className="realm-top">
        <div>
          <h2>{realm.name}</h2>
          <p className="realm-covers">{realm.covers}</p>
        </div>
        <div className="realm-level">Lv {progress.level}</div>
      </div>

      <div
        className="bar"
        role="progressbar"
        aria-label={`${realm.name} XP`}
        aria-valuemin={0}
        aria-valuemax={progress.xpForThisLevel}
        aria-valuenow={progress.xpIntoLevel}
      >
        <div className="bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="bar-text">
        {progress.xpIntoLevel} / {progress.xpForThisLevel} XP to level{' '}
        {progress.level + 1}
      </p>

      {/* Today's daily quests: one tap ticks one off until midnight. */}
      {dailies.length > 0 && (
        <div className="dailies">
          {dailies.map((daily) => (
            <DailyRow key={daily.id} daily={daily} onTick={onDaily} />
          ))}
        </div>
      )}

      <div className="realm-buttons">
        <button
          type="button"
          className="button"
          onClick={() => onLog(realm.id, XP_SMALL)}
        >
          Small <span className="button-xp">+{XP_SMALL}</span>
        </button>
        <button
          type="button"
          className="button button-strong"
          onClick={() => onLog(realm.id, XP_BIG)}
        >
          Big <span className="button-xp">+{XP_BIG}</span>
        </button>
      </div>
    </section>
  )
}
