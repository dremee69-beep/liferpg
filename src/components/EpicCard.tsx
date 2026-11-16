// ONE EPIC QUEST in the Quest log: its milestones as a checklist.
// Ticking a milestone takes two taps, because it pays 100 XP and should only
// be done when the milestone is really finished.

import { useState } from 'react'
import type { EpicView } from '../game/epics.ts'
import { EPIC_MILESTONE_XP } from '../game/rules.ts'
import type { Milestone } from '../storage/save.ts'
import { ConfirmButton } from './ConfirmButton.tsx'
import { Icon } from './Icon.tsx'

type Props = {
  view: EpicView
  onTick: (milestoneId: string) => void
  onEdit: () => void
  onRemove: () => void
}

// One milestone row. The first tap asks "are you sure?"; the second ticks
// it. Tapping anywhere else cancels.
function MilestoneRow({
  milestone,
  onTick,
}: {
  milestone: Milestone
  onTick: () => void
}) {
  const [armed, setArmed] = useState(false)
  const done = milestone.doneAt !== null

  let className = 'daily'
  if (done) className += ' daily-done'
  else if (armed) className += ' milestone-armed'

  return (
    <button
      type="button"
      className={className}
      disabled={done}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onTick()
        } else {
          setArmed(true)
        }
      }}
      onBlur={() => setArmed(false)}
    >
      <span className="daily-box" aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      <span className="daily-name">{milestone.name}</span>
      <span className="daily-xp">
        {done ? 'Done' : armed ? 'Tap again to confirm' : `+${EPIC_MILESTONE_XP}`}
      </span>
    </button>
  )
}

export function EpicCard({ view, onTick, onEdit, onRemove }: Props) {
  return (
    <article className="challenge" data-realm={view.realm}>
      <div className="challenge-top">
        <Icon name={view.realm} size={24} />
        <h3 className="challenge-name">{view.name}</h3>
        <span className="challenge-tier-chip">
          {view.allDone ? 'Complete' : `${view.doneCount} of ${view.total}`}
        </span>
      </div>

      <div className="epic-milestones">
        {view.milestones.map((milestone) => (
          <MilestoneRow
            key={milestone.id}
            milestone={milestone}
            onTick={() => onTick(milestone.id)}
          />
        ))}
      </div>

      {view.allDone && (
        <p className="challenge-text">
          Every milestone is done. Tap Edit if this quest has more to come.
        </p>
      )}

      <div className="challenge-actions">
        <button type="button" className="link-button" onClick={onEdit}>
          Edit
        </button>
        <ConfirmButton label="Remove" onConfirm={onRemove} />
      </div>
    </article>
  )
}
