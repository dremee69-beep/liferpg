// ONE REALM CARD: icon, name, level, XP bar, today's daily quests, and the
// two one-tap log buttons for anything else.

import type { ChallengeView } from '../game/challenges.ts'
import type { DailyStatus } from '../game/dailies.ts'
import { XP_BIG, XP_SMALL } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import { levelProgress } from '../game/xp.ts'
import { DailyRow } from './DailyRow.tsx'
import { PixelIcon } from './PixelIcon.tsx'
import { useXpPops } from './XpPops.tsx'

type Props = {
  realm: { id: RealmId; name: string; covers: string }
  xp: number // total XP in this realm
  dailies: DailyStatus[]
  challenges: ChallengeView[] // this realm's challenges
  onLog: (realm: RealmId, xp: number) => void
  onDaily: (dailyId: string) => void
}

// The short progress text for a challenge, shown on its realm's card.
function challengeLine(challenge: ChallengeView): string {
  if (challenge.startsNextWeek) return 'Next tier starts Monday'
  if (challenge.weekCounted) return 'This week done ✓'
  const days = Math.min(challenge.daysThisWeek, challenge.daysTarget)
  const word = challenge.daysTarget === 1 ? 'day' : 'days'
  return `${days} of ${challenge.daysTarget} ${word} this week`
}

// One of the two log buttons. It is its own little piece so that each button
// can float its own "+10" / "+25" when tapped.
function LogButton({
  label,
  xp,
  strong,
  onLog,
}: {
  label: string
  xp: number
  strong: boolean
  onLog: () => void
}) {
  const pops = useXpPops()
  return (
    <button
      type="button"
      className={strong ? 'button button-strong' : 'button'}
      onClick={() => {
        pops.fire(`+${xp}`)
        onLog()
      }}
    >
      {label} <span className="button-xp">+{xp}</span>
      {pops.element}
    </button>
  )
}

export function RealmCard({
  realm,
  xp,
  dailies,
  challenges,
  onLog,
  onDaily,
}: Props) {
  const progress = levelProgress(xp)
  // How full the bar is, as a percentage from 0 to 100.
  const percent = (progress.xpIntoLevel / progress.xpForThisLevel) * 100

  return (
    // data-realm lets the CSS give each realm its own colour.
    <section className="realm" data-realm={realm.id}>
      <div className="realm-top">
        <div className="realm-title">
          <PixelIcon name={realm.id} size={36} />
          <div>
            <h2>{realm.name}</h2>
            <p className="realm-covers">{realm.covers}</p>
          </div>
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

      {/* One line per challenge still in progress in this realm. */}
      {challenges
        .filter((challenge) => !challenge.allTiersDone)
        .map((challenge) => (
          <p key={challenge.id} className="realm-challenge">
            <span className="realm-challenge-name">{challenge.name}</span>
            <span>
              {challengeLine(challenge)}
            </span>
          </p>
        ))}

      {/* Today's daily quests: one tap ticks one off until midnight. */}
      {dailies.length > 0 && (
        <div className="dailies">
          {dailies.map((daily) => (
            <DailyRow key={daily.id} daily={daily} onTick={onDaily} />
          ))}
        </div>
      )}

      <div className="realm-buttons">
        <LogButton
          label="Small"
          xp={XP_SMALL}
          strong={false}
          onLog={() => onLog(realm.id, XP_SMALL)}
        />
        <LogButton
          label="Big"
          xp={XP_BIG}
          strong
          onLog={() => onLog(realm.id, XP_BIG)}
        />
      </div>
    </section>
  )
}
