// THE EPIC QUEST FORM: used both to add a new epic quest and to edit one.
// You pick a realm, a name, and type the milestones one per line.
// When editing, milestones that are already ticked are shown but locked.

import { useState } from 'react'
import { cleanMilestoneNames } from '../game/epics.ts'
import type { EpicInput } from '../game/epics.ts'
import {
  EPIC_MILESTONE_XP,
  MAX_EPIC_NAME_LENGTH,
  MAX_MILESTONES,
  REALMS,
} from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import type { EpicQuest } from '../storage/save.ts'

type Props = {
  existing?: EpicQuest // given when editing; left out when adding
  // `milestones` holds only the ones still to do; ticked ones are kept as
  // they are.
  onSave: (input: EpicInput) => void
  onCancel: () => void
}

export function EpicForm({ existing, onSave, onCancel }: Props) {
  // Ticked milestones cannot be changed; the rest can.
  const locked = existing
    ? existing.milestones.filter((milestone) => milestone.doneAt !== null)
    : []
  const open = existing
    ? existing.milestones.filter((milestone) => milestone.doneAt === null)
    : []

  const [realm, setRealm] = useState<RealmId>(existing?.realm ?? 'questAbroad')
  const [name, setName] = useState(existing?.name ?? '')
  // The milestones still to do, as text with one on each line.
  const [lines, setLines] = useState(open.map((m) => m.name).join('\n'))

  const names = cleanMilestoneNames(lines.split('\n'))
  const total = locked.length + names.length
  const tooMany = total > MAX_MILESTONES
  const canSave = name.trim() !== '' && total > 0 && !tooMany

  return (
    <form
      className="challenge-form"
      data-realm={realm}
      onSubmit={(event) => {
        event.preventDefault() // stop the browser from reloading the page
        if (!canSave) return
        onSave({ realm, name, milestones: names })
      }}
    >
      <label className="field">
        <span className="field-label">Realm</span>
        <select
          className="edit-select"
          value={realm}
          // The realm of an existing epic quest cannot be changed.
          disabled={existing !== undefined}
          onChange={(event) => setRealm(event.target.value as RealmId)}
        >
          {REALMS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Epic quest name</span>
        <input
          className="edit-input"
          type="text"
          value={name}
          maxLength={MAX_EPIC_NAME_LENGTH}
          placeholder="Your big goal"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className="field">
        <label className="field-label" htmlFor="epic-milestones">
          Milestones, one per line
        </label>

        {locked.map((milestone) => (
          <p key={milestone.id} className="tier-locked">
            ✓ {milestone.name} (done)
          </p>
        ))}

        <textarea
          id="epic-milestones"
          className="edit-input edit-textarea"
          rows={6}
          value={lines}
          placeholder={'First step\nNext step\nFinal step'}
          onChange={(event) => setLines(event.target.value)}
        />
        <p className={tooMany ? 'import-warning' : 'challenge-hint'}>
          {tooMany
            ? `That is ${total} milestones. The most an epic quest can have is ${MAX_MILESTONES}.`
            : `${total} ${total === 1 ? 'milestone' : 'milestones'}, worth ${EPIC_MILESTONE_XP} XP each.`}
        </p>
      </div>

      <div className="button-row">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button-strong" disabled={!canSave}>
          {existing ? 'Save changes' : 'Start quest'}
        </button>
      </div>
    </form>
  )
}
