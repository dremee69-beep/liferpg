// IMPORT A SAVE FILE
// Lets the player choose a backup file, checks it, shows what is inside, and
// only replaces the progress on this device after they confirm.
// Used in two places: the Camp screen and the first-launch screen (new phone).

import { useRef, useState } from 'react'
import { PLAYERS } from '../game/rules.ts'
import { playerLevel } from '../game/xp.ts'
import { parseSave } from '../storage/save.ts'
import type { SaveData } from '../storage/save.ts'

type Props = {
  // True when there is already progress on this device that would be replaced.
  hasExistingSave: boolean
  onImport: (save: SaveData) => void
}

// A real save file is tiny. Anything bigger than this is the wrong file.
const MAX_FILE_BYTES = 5_000_000

export function ImportSave({ hasExistingSave, onImport }: Props) {
  // The hidden file chooser. Our own button "clicks" it for us.
  const fileInput = useRef<HTMLInputElement>(null)
  // A save that was read from a file and is waiting for the player's OK.
  const [pending, setPending] = useState<SaveData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChosen(file: File | undefined) {
    if (file === undefined) return // the player closed the chooser
    setPending(null)
    setError(null)

    if (file.size > MAX_FILE_BYTES) {
      setError('That file is too big to be a LifeRPG save.')
      return
    }
    try {
      const save = parseSave(await file.text())
      if (save === null) {
        setError(
          'That file is not a LifeRPG save this app can read. Nothing was changed.',
        )
      } else {
        setPending(save)
      }
    } catch {
      setError('Could not read that file. Nothing was changed.')
    }
  }

  // Step 2: show what is in the file and ask before replacing anything.
  if (pending !== null) {
    const name = PLAYERS.find((p) => p.id === pending.player)?.name
    return (
      <div className="import-confirm">
        <p>
          <strong>{name}</strong>, player level {playerLevel(pending.realmXp)},{' '}
          {pending.log.length} {pending.log.length === 1 ? 'action' : 'actions'}{' '}
          logged.
        </p>
        {hasExistingSave && (
          <p className="import-warning">
            This replaces the progress on this device. It cannot be undone.
          </p>
        )}
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => setPending(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-strong"
            onClick={() => onImport(pending)}
          >
            {hasExistingSave ? 'Replace' : 'Use this save'}
          </button>
        </div>
      </div>
    )
  }

  // Step 1: the button that opens the file chooser.
  return (
    <div>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        hidden
        onChange={(event) => {
          handleFileChosen(event.target.files?.[0])
          // Clear the chooser so picking the same file again still works.
          event.target.value = ''
        }}
      />
      <button
        type="button"
        className="button button-wide"
        onClick={() => fileInput.current?.click()}
      >
        Import save file
      </button>
      {error !== null && (
        <p className="import-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
