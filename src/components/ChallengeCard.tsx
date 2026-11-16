// ONE CHALLENGE in the Quest log: which tier you are on, this week's days,
// and how many weeks of the tier are done.

import type { ChallengeView } from '../game/challenges.ts'
import { ConfirmButton } from './ConfirmButton.tsx'
import { PixelIcon } from './PixelIcon.tsx'

type Props = {
  view: ChallengeView
  onEdit: () => void
  onRemove: () => void
}

// A row of little boxes, the first `filled` of them coloured in.
// Used for "days this week" and "weeks done".
function Boxes({ total, filled }: { total: number; filled: number }) {
  return (
    <span className="boxes" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < filled ? 'box box-filled' : 'box'} />
      ))}
    </span>
  )
}

// "1 day" but "2 days".
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function ChallengeCard({ view, onEdit, onRemove }: Props) {
  return (
    <article className="challenge" data-realm={view.realm}>
      <div className="challenge-top">
        <PixelIcon name={view.realm} size={24} />
        <h3 className="challenge-name">{view.name}</h3>
        <span className="challenge-tier-chip">
          {view.allTiersDone
            ? 'Complete'
            : `Tier ${view.tierNumber} of ${view.tierCount}`}
        </span>
      </div>

      {view.allTiersDone ? (
        <p className="challenge-text">
          Every tier is finished. Tap Edit to add the next tier after your
          Game Master session.
        </p>
      ) : (
        <>
          <p className="challenge-text">
            <strong>{view.tierName}</strong>: {plural(view.daysTarget, 'day')} a
            week for {plural(view.weeksTarget, 'week')}
          </p>

          {view.startsNextWeek ? (
            // This week was used by the tier just finished.
            <p className="challenge-text">This tier starts counting on Monday.</p>
          ) : (
            <div className="challenge-row">
              <span className="challenge-label">This week</span>
              <Boxes total={view.daysTarget} filled={view.daysThisWeek} />
              <span className="challenge-count">
                {view.weekCounted
                  ? 'Done ✓'
                  : `${Math.min(view.daysThisWeek, view.daysTarget)} of ${plural(view.daysTarget, 'day')}`}
              </span>
            </div>
          )}

          <div className="challenge-row">
            <span className="challenge-label">Weeks</span>
            <Boxes total={view.weeksTarget} filled={view.weeksDone} />
            <span className="challenge-count">
              {view.weeksDone} of {view.weeksTarget}
            </span>
          </div>

          {!view.weekCounted && (
            <p className="challenge-hint">
              {plural(view.daysLeftThisWeek, 'day')} left this week, counting
              today.
            </p>
          )}
        </>
      )}

      <p className="challenge-hint">{view.countsLabel}</p>

      <div className="challenge-actions">
        <button type="button" className="link-button" onClick={onEdit}>
          Edit
        </button>
        <ConfirmButton label="Remove" onConfirm={onRemove} />
      </div>
    </article>
  )
}
