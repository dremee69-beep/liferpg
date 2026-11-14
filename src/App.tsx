// THE APP: the conductor. It holds the save in memory, decides which screen
// to show, and writes the save to the device after every change.

import { useEffect, useState } from 'react'
import { Camp } from './components/Camp.tsx'
import { PlayerPicker } from './components/PlayerPicker.tsx'
import { Village } from './components/Village.tsx'
import { logAction, undoLastAction } from './game/actions.ts'
import { REALMS } from './game/rules.ts'
import type { PlayerId, RealmId } from './game/rules.ts'
import { levelForXp } from './game/xp.ts'
import {
  askToKeepData,
  loadSave,
  newSave,
  writeSave,
} from './storage/save.ts'
import type { SaveData } from './storage/save.ts'

// The little message that pops up at the bottom after you log something.
type Notice = {
  id: number // changes every time, so the hide-timer restarts
  text: string
  levelUp: boolean
  canUndo: boolean
}

// How long the message stays on screen, in milliseconds.
const NOTICE_MS = 4000

function App() {
  // The save lives here while the app is open. loadSave() runs once at start;
  // null means "no save on this device yet".
  const [save, setSave] = useState<SaveData | null>(() => loadSave())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  // Which screen is showing once a player exists.
  const [screen, setScreen] = useState<'village' | 'camp'>('village')

  // Hide the message by itself after a few seconds.
  useEffect(() => {
    if (notice === null) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // Once there is a save worth protecting, ask the phone to keep our data.
  const hasSave = save !== null
  useEffect(() => {
    if (hasSave) askToKeepData()
  }, [hasSave])

  // Every change goes through here: update the screen AND the device.
  function commit(next: SaveData) {
    setSave(next)
    setSaveFailed(!writeSave(next))
  }

  function handlePick(player: PlayerId) {
    commit(newSave(player))
  }

  function handleLog(realmId: RealmId, xp: number) {
    if (save === null) return
    const next = logAction(save, realmId, xp, new Date())
    commit(next)

    const realmName = REALMS.find((realm) => realm.id === realmId)?.name
    const levelBefore = levelForXp(save.realmXp[realmId])
    const levelAfter = levelForXp(next.realmXp[realmId])
    const levelUp = levelAfter > levelBefore

    setNotice({
      id: Date.now(),
      text: levelUp
        ? `Level up! ${realmName} is now level ${levelAfter}`
        : `+${xp} XP in ${realmName}`,
      levelUp,
      canUndo: true,
    })
  }

  function handleUndo() {
    if (save === null) return
    commit(undoLastAction(save))
    setNotice({ id: Date.now(), text: 'Undone', levelUp: false, canUndo: false })
  }

  // A backup file was chosen and confirmed: use it as the save.
  function handleImport(imported: SaveData) {
    commit(imported)
    setScreen('village')
    setNotice({
      id: Date.now(),
      text: 'Save imported',
      levelUp: false,
      canUndo: false,
    })
  }

  // First launch: ask who is playing (or bring in a backup).
  if (save === null) {
    return <PlayerPicker onPick={handlePick} onImport={handleImport} />
  }

  return (
    <>
      {saveFailed && (
        <p className="warning" role="alert">
          Could not save on this device. Your latest taps may be lost if you
          close the app.
        </p>
      )}

      {screen === 'village' ? (
        <Village
          save={save}
          onLog={handleLog}
          onOpenCamp={() => setScreen('camp')}
        />
      ) : (
        <Camp
          save={save}
          onBack={() => setScreen('village')}
          onImport={handleImport}
        />
      )}

      {notice !== null && (
        <div
          className={notice.levelUp ? 'notice notice-levelup' : 'notice'}
          role="status"
        >
          <span>{notice.text}</span>
          {notice.canUndo && (
            <button type="button" className="notice-undo" onClick={handleUndo}>
              Undo
            </button>
          )}
        </div>
      )}
    </>
  )
}

export default App
