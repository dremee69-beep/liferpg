// EDIT YOUR DAILY QUESTS: rename, resize, remove or add, realm by realm.
// Each realm keeps between 1 and 3 dailies, and each daily is Small or Big.

import { useState } from 'react'
import { canAddDaily, canRemoveDaily } from '../game/dailies.ts'
import {
  DAILY_XP_CHOICES,
  MAX_DAILIES_PER_REALM,
  MAX_DAILY_NAME_LENGTH,
  REALMS,
  XP_SMALL,
} from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import type { SaveData } from '../storage/save.ts'
import { ConfirmButton } from './ConfirmButton.tsx'

type Props = {
  save: SaveData
  onAdd: (realm: RealmId, name: string, xp: number) => void
  onRename: (dailyId: string, name: string) => void
  onResize: (dailyId: string, xp: number) => void
  onRemove: (dailyId: string) => void
}

// The Small / Big switch: two buttons side by side, one of them filled in.
function SizePicker({
  value,
  label,
  onChange,
}: {
  value: number
  label: string // read out by screen readers, e.g. "Size of Read for 20 minutes"
  onChange: (xp: number) => void
}) {
  return (
    <div className="size-picker" role="group" aria-label={label}>
      {DAILY_XP_CHOICES.map((choice) => (
        <button
          key={choice.xp}
          type="button"
          className={choice.xp === value ? 'size size-current' : 'size'}
          // Tells screen readers which of the two is switched on.
          aria-pressed={choice.xp === value}
          onClick={() => onChange(choice.xp)}
        >
          {choice.name} +{choice.xp}
        </button>
      ))}
    </div>
  )
}

// The "add a daily" box for one realm. It keeps what is being typed, and the
// chosen size, in its own little memory until Add is tapped.
function AddDaily({ onAdd }: { onAdd: (name: string, xp: number) => void }) {
  const [typed, setTyped] = useState('')
  const [xp, setXp] = useState<number>(XP_SMALL)

  function submit() {
    if (typed.trim() === '') return
    onAdd(typed, xp)
    setTyped('')
    setXp(XP_SMALL)
  }

  return (
    <form
      className="edit-daily edit-daily-new"
      onSubmit={(event) => {
        event.preventDefault() // stop the browser from reloading the page
        submit()
      }}
    >
      <input
        className="edit-input"
        type="text"
        value={typed}
        maxLength={MAX_DAILY_NAME_LENGTH}
        placeholder="New daily quest"
        aria-label="New daily quest"
        onChange={(event) => setTyped(event.target.value)}
      />
      <div className="edit-controls">
        <SizePicker value={xp} label="Size of the new daily" onChange={setXp} />
        <button type="submit" className="edit-add" disabled={typed.trim() === ''}>
          Add
        </button>
      </div>
    </form>
  )
}

export function EditDailies({
  save,
  onAdd,
  onRename,
  onResize,
  onRemove,
}: Props) {
  return (
    <div className="edit-dailies">
      <p className="panel-text">
        Type over a name to change it, and pick Small or Big for what it is
        worth. Each realm keeps 1 to {MAX_DAILIES_PER_REALM} dailies. Changes
        never touch XP you already earned.
      </p>

      {REALMS.map((realm) => {
        const dailies = save.dailies.filter((d) => d.realm === realm.id)
        return (
          <div key={realm.id} className="quest-group" data-realm={realm.id}>
            <h3 className="quest-group-name">{realm.name}</h3>

            {dailies.map((daily) => (
              // The key includes the name, so after a rename the box is
              // rebuilt showing the tidied name.
              <div key={`${daily.id}-${daily.name}`} className="edit-daily">
                <input
                  className="edit-input"
                  type="text"
                  defaultValue={daily.name}
                  maxLength={MAX_DAILY_NAME_LENGTH}
                  aria-label={`Name of daily: ${daily.name}`}
                  // The new name is saved when you leave the box...
                  onBlur={(event) => {
                    onRename(daily.id, event.target.value)
                    // An emptied box goes back to the old name.
                    if (event.target.value.trim() === '') {
                      event.target.value = daily.name
                    }
                  }}
                  // ...or press Enter / Done on the keyboard.
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                />
                <div className="edit-controls">
                  <SizePicker
                    value={daily.xp}
                    label={`Size of ${daily.name}`}
                    onChange={(xp) => onResize(daily.id, xp)}
                  />
                  <ConfirmButton
                    label="Remove"
                    disabled={!canRemoveDaily(save, daily.id)}
                    onConfirm={() => onRemove(daily.id)}
                  />
                </div>
              </div>
            ))}

            {canAddDaily(save, realm.id) && (
              <AddDaily onAdd={(name, xp) => onAdd(realm.id, name, xp)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
