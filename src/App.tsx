// THE APP: the conductor. It holds the save in memory, decides which screen
// to show, and writes the save to the device after every change.

import { useCallback, useEffect, useState } from 'react'
import { Camp } from './components/Camp.tsx'
import { LevelUpCard } from './components/LevelUpCard.tsx'
import { PlayerPicker } from './components/PlayerPicker.tsx'
import { QuestLog } from './components/QuestLog.tsx'
import { TabBar } from './components/TabBar.tsx'
import type { ScreenId } from './components/TabBar.tsx'
import { Village } from './components/Village.tsx'
import {
  completeDaily,
  logAction,
  removeLogEntry,
  undoLastAction,
} from './game/actions.ts'
import {
  addDaily,
  removeDaily,
  renameDaily,
  setDailyXp,
} from './game/dailies.ts'
import { REALMS } from './game/rules.ts'
import type { PlayerId, RealmId } from './game/rules.ts'
import { buzz } from './feedback.ts'
import { levelForXp, playerLevel } from './game/xp.ts'
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

// A realm that has just reached a new level.
type LevelUp = {
  id: number // changes every time, so two level-ups in a row both show
  realm: RealmId
  level: number
}

// How long the message stays on screen, in milliseconds.
const NOTICE_MS = 4000

function App() {
  // The save lives here while the app is open. loadSave() runs once at start;
  // null means "no save on this device yet".
  const [save, setSave] = useState<SaveData | null>(() => loadSave())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  // Set when a realm has just levelled up, to show the level-up card.
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null)
  // useCallback keeps this the very same function between screen refreshes,
  // so the card's close-by-itself timer is not restarted by accident.
  const closeLevelUp = useCallback(() => setLevelUp(null), [])
  // Which screen is showing once a player exists.
  const [screen, setScreen] = useState<ScreenId>('village')

  // Hide the message by itself after a few seconds.
  useEffect(() => {
    if (notice === null) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // The current time, which decides what counts as "today" for dailies.
  // It is refreshed every minute and whenever the app comes back to the
  // front, so dailies open up again after midnight without restarting.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const timer = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

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

  // For edits that may turn out to be "nothing changed" (for example a
  // rename to the same name): only save when there is something new.
  function commitIfChanged(next: SaveData) {
    if (next !== save) commit(next)
  }

  // Switching tabs: show the new screen from its top.
  function handleChangeScreen(next: ScreenId) {
    setScreen(next)
    setNow(new Date())
    window.scrollTo(0, 0)
  }

  function handlePick(player: PlayerId) {
    commit(newSave(player))
  }

  // Shared by every XP-earning tap: save the change, then show a message
  // (a level-up message if the realm just reached a new level).
  function commitXpGain(
    before: SaveData,
    after: SaveData,
    realmId: RealmId,
    text: string,
  ) {
    commit(after)
    setNow(new Date())

    const levelBefore = levelForXp(before.realmXp[realmId])
    const levelAfter = levelForXp(after.realmXp[realmId])

    if (levelAfter > levelBefore) {
      // A new level: show the level-up card and give a longer buzz.
      setLevelUp({ id: Date.now(), realm: realmId, level: levelAfter })
      buzz('levelUp')
    } else {
      buzz('tap')
    }

    // The message bar always appears, so Undo is there even on a level-up.
    setNotice({ id: Date.now(), text, levelUp: false, canUndo: true })
  }

  // The Small / Big buttons.
  function handleLog(realmId: RealmId, xp: number) {
    if (save === null) return
    const realmName = REALMS.find((realm) => realm.id === realmId)?.name
    const next = logAction(save, realmId, xp, new Date())
    commitXpGain(save, next, realmId, `+${xp} XP in ${realmName}`)
  }

  // Ticking a daily quest.
  function handleDaily(dailyId: string) {
    if (save === null) return
    const daily = save.dailies.find((d) => d.id === dailyId)
    const next = completeDaily(save, dailyId, new Date())
    // completeDaily hands back the same save when there was nothing to do
    // (already done today), so there is nothing to save or announce.
    if (daily === undefined || next === save) return
    commitXpGain(save, next, daily.realm, `+${daily.xp} XP: ${daily.name}`)
  }

  function handleUndo() {
    if (save === null) return
    setLevelUp(null) // if the undone tap caused a level-up, hide its card
    commit(undoLastAction(save))
    setNotice({ id: Date.now(), text: 'Undone', levelUp: false, canUndo: false })
  }

  // "Remove" on an entry in the Recent activity list.
  function handleRemoveEntry(index: number) {
    if (save === null) return
    const entry = save.log[index]
    if (entry === undefined) return
    commit(removeLogEntry(save, index))
    setNow(new Date())
    setNotice({
      id: Date.now(),
      text: `Removed, ${entry.xp} XP taken back`,
      levelUp: false,
      canUndo: false,
    })
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

      {screen === 'village' && (
        <Village
          save={save}
          now={now}
          onLog={handleLog}
          onDaily={handleDaily}
          onRemoveEntry={handleRemoveEntry}
        />
      )}
      {screen === 'quests' && (
        <QuestLog
          save={save}
          now={now}
          onDaily={handleDaily}
          onAddDaily={(realm, name, xp) =>
            commitIfChanged(addDaily(save, realm, name, xp, new Date()))
          }
          onResizeDaily={(dailyId, xp) =>
            commitIfChanged(setDailyXp(save, dailyId, xp))
          }
          onRenameDaily={(dailyId, name) =>
            commitIfChanged(renameDaily(save, dailyId, name))
          }
          onRemoveDaily={(dailyId) =>
            commitIfChanged(removeDaily(save, dailyId))
          }
        />
      )}
      {screen === 'camp' && <Camp save={save} onImport={handleImport} />}

      <TabBar current={screen} onChange={handleChangeScreen} />

      {levelUp !== null && (
        <LevelUpCard
          key={levelUp.id}
          realm={levelUp.realm}
          level={levelUp.level}
          playerLevel={playerLevel(save.realmXp)}
          onClose={closeLevelUp}
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
