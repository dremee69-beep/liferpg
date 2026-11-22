// THE APP: the conductor. It holds the save in memory, decides which screen
// to show, and writes the save to the device after every change.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camp } from './components/Camp.tsx'
import { CelebrationCard } from './components/CelebrationCard.tsx'
import { History } from './components/History.tsx'
import { MapScreen } from './components/MapScreen.tsx'
import { PlayerPicker } from './components/PlayerPicker.tsx'
import { QuestLog } from './components/QuestLog.tsx'
import { TabBar } from './components/TabBar.tsx'
import type { ScreenId } from './components/TabBar.tsx'
import { Village } from './components/Village.tsx'
import { buzz } from './feedback.ts'
import {
  completeDaily,
  logAction,
  removeLogEntry,
  undoLastAction,
} from './game/actions.ts'
import {
  addChallenge,
  removeChallenge,
  settleChallenges,
  updateChallenge,
} from './game/challenges.ts'
import type { ShieldUse, TierCompletion } from './game/challenges.ts'
import {
  addDaily,
  removeDaily,
  renameDaily,
  setDailyXp,
} from './game/dailies.ts'
import {
  addEpic,
  completeMilestone,
  epicView,
  removeEpic,
  updateEpic,
} from './game/epics.ts'
import {
  addPartyQuest,
  cancelPartyLog,
  confirmPartyLog,
  declinePartyLog,
  logPartyQuest,
  removePartyQuest,
} from './game/party.ts'
import { addExplorerQuests, newlyReached } from './game/mapMilestones.ts'
import {
  addPin,
  confirmPin,
  declinePin,
  NO_PIN_NEWS,
  removePin,
  updatePin,
} from './game/pins.ts'
import { applyPartnerCode } from './game/share.ts'
import type { PartnerCodeResult } from './game/share.ts'
import {
  EPIC_MILESTONE_XP,
  MAX_SHIELDS,
  PARTY_QUEST_XP,
  REALMS,
  TIER_REWARD_SKILL_POINTS,
  TIER_REWARD_XP,
} from './game/rules.ts'
import type { PlayerId, RealmId } from './game/rules.ts'
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
  canUndo: boolean
}

// Something worth a card in the middle of the screen. If several happen at
// once (a tap finishes a tier AND levels up the realm) they wait in a queue
// and are shown one after another.
type CelebrationContent =
  | { kind: 'level'; realm: RealmId; level: number }
  | { kind: 'tier'; done: TierCompletion }
  | { kind: 'shield'; used: ShieldUse }
  | {
      kind: 'milestone'
      realm: RealmId
      epicName: string
      milestoneName: string
      allDone: boolean // true when this was the epic's last milestone
    }
  | { kind: 'map'; name: string; reward: string } // a map milestone reached
// Once queued, each card also gets a number of its own.
type Celebration = CelebrationContent & { id: number }

// How long the message stays on screen, in milliseconds.
const NOTICE_MS = 4000

function App() {
  // The save lives here while the app is open. loadSave() runs once at start;
  // null means "no save on this device yet".
  const [save, setSave] = useState<SaveData | null>(() => loadSave())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  // Which screen is showing once a player exists.
  const [screen, setScreen] = useState<ScreenId>('village')
  // History is opened from the Village and shown in its place.
  const [historyOpen, setHistoryOpen] = useState(false)

  // The queue of celebration cards. The first one is the one on screen.
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const nextCelebrationId = useRef(0)
  // useCallback keeps this the very same function between screen refreshes,
  // so a card's close-by-itself timer is not restarted by accident.
  const closeCelebration = useCallback(
    () => setCelebrations((queue) => queue.slice(1)),
    [],
  )

  // Hide the message by itself after a few seconds.
  useEffect(() => {
    if (notice === null) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // The current time, which decides what counts as "today" and "this week".
  // It is refreshed every minute and whenever the app comes back to the
  // front, so dailies reopen after midnight and weeks roll over on Monday
  // without restarting the app.
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

  // Add cards to the end of the celebration queue.
  function celebrate(cards: CelebrationContent[]) {
    if (cards.length === 0) return
    const withIds = cards.map((card): Celebration => {
      nextCelebrationId.current += 1
      return { ...card, id: nextCelebrationId.current }
    })
    setCelebrations((queue) => [...queue, ...withIds])
  }

  // Every change goes through here: bring the challenges up to date, then
  // update the screen AND the device.
  function commit(next: SaveData) {
    const settled = settleChallenges(next, new Date())
    setSave(settled.save)
    setSaveFailed(!writeSave(settled.save))

    // A finished tier gets a card. If its 50 bonus XP also pushed the realm
    // up a level, that gets a card too, straight after.
    const cards: CelebrationContent[] = []
    // A shield that covered a missed week is announced first.
    for (const used of settled.shieldsUsed) {
      cards.push({ kind: 'shield', used })
    }
    for (const done of settled.completed) {
      cards.push({ kind: 'tier', done })
      const levelBefore = levelForXp(next.realmXp[done.realm])
      const levelAfter = levelForXp(settled.save.realmXp[done.realm])
      if (levelAfter > levelBefore) {
        cards.push({ kind: 'level', realm: done.realm, level: levelAfter })
      }
    }
    // A map milestone reached (by confirming a pin, or by your partner's
    // code confirming one of yours) gets a card too.
    if (save !== null) {
      for (const milestone of newlyReached(save, settled.save)) {
        cards.push({ kind: 'map', name: milestone.name, reward: milestone.reward })
      }
    }
    if (cards.length > 0) buzz('levelUp')
    celebrate(cards)
  }

  // Time passing can change things on its own: a new week begins, or the app
  // is opened after days away. So whenever the clock is refreshed (and once
  // when the app starts) we settle up, and save only if something changed.
  useEffect(() => {
    if (save === null) return
    if (settleChallenges(save, now).save !== save) commit(save)
    // This should run when the clock moves, not on every save change:
    // commit() already settles each change as it happens.
  }, [now])

  // For edits that may turn out to be "nothing changed" (for example a
  // rename to the same name): only save when there is something new.
  function commitIfChanged(next: SaveData) {
    if (next !== save) commit(next)
  }

  // Switching tabs: show the new screen from its top.
  function handleChangeScreen(next: ScreenId) {
    setScreen(next)
    setHistoryOpen(false) // tapping any tab leaves History
    setNow(new Date())
    window.scrollTo(0, 0)
  }

  function handlePick(player: PlayerId) {
    commit(newSave(player))
  }

  // Shared by every XP-earning tap: save the change, then show a message
  // (and a level-up card if the realm just reached a new level).
  function commitXpGain(
    before: SaveData,
    after: SaveData,
    realmId: RealmId,
    text: string,
  ) {
    const levelBefore = levelForXp(before.realmXp[realmId])
    const levelAfter = levelForXp(after.realmXp[realmId])

    if (levelAfter > levelBefore) {
      celebrate([{ kind: 'level', realm: realmId, level: levelAfter }])
      buzz('levelUp')
    } else {
      buzz('tap')
    }

    commit(after)
    setNow(new Date())

    // The message bar always appears, so Undo is there even on a level-up.
    setNotice({ id: Date.now(), text, canUndo: true })
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

  // Ticking an epic quest's milestone (after the confirming second tap).
  function handleMilestone(epicId: string, milestoneId: string) {
    if (save === null) return
    const epic = save.epics.find((e) => e.id === epicId)
    const milestone = epic?.milestones.find((m) => m.id === milestoneId)
    const next = completeMilestone(save, epicId, milestoneId, new Date())
    if (epic === undefined || milestone === undefined || next === save) return

    const after = next.epics.find((e) => e.id === epicId)
    celebrate([
      {
        kind: 'milestone',
        realm: epic.realm,
        epicName: epic.name,
        milestoneName: milestone.name,
        allDone: after !== undefined && epicView(after).allDone,
      },
    ])
    commitXpGain(
      save,
      next,
      epic.realm,
      `+${EPIC_MILESTONE_XP} XP: ${milestone.name}`,
    )
  }

  function handleUndo() {
    if (save === null) return
    setCelebrations([]) // hide any card the undone tap caused
    commit(undoLastAction(save))
    setNotice({ id: Date.now(), text: 'Undone', canUndo: false })
  }

  // "Remove" on an entry in the Recent activity list.
  function handleRemoveEntry(index: number) {
    if (save === null) return
    const entry = save.log[index]
    const next = removeLogEntry(save, index)
    if (entry === undefined || next === save) return
    commit(next)
    setNow(new Date())
    setNotice({
      id: Date.now(),
      text: `Removed, ${entry.xp} XP taken back`,
      canUndo: false,
    })
  }

  // Saves a change that paid Together XP for party quests, with a card if
  // the realm just reached a new level. There is no Undo for these: the XP
  // was agreed by both players.
  function commitPartyGain(before: SaveData, after: SaveData) {
    const levelBefore = levelForXp(before.realmXp.together)
    const levelAfter = levelForXp(after.realmXp.together)
    if (levelAfter > levelBefore) {
      celebrate([{ kind: 'level', realm: 'together', level: levelAfter }])
      buzz('levelUp')
    } else if (after.realmXp.together > before.realmXp.together) {
      buzz('tap')
    }
    commit(after)
    setNow(new Date())
  }

  // A partner's share code was pasted in Camp. Tells Camp why it was not
  // used, or what party quest and pin news the code brought.
  function handlePartnerCode(text: string): PartnerCodeResult {
    if (save === null) {
      return {
        problem: 'unreadable',
        news: { toConfirm: [], confirmed: [], declined: [] },
        pinNews: NO_PIN_NEWS,
      }
    }
    const result = applyPartnerCode(save, text, new Date())
    if (result.problem === null) commitPartyGain(save, result.save)
    return { problem: result.problem, news: result.news, pinNews: result.pinNews }
  }

  // Confirming a party quest the partner logged: pays the Together XP.
  function handleConfirmParty(logId: string) {
    if (save === null) return
    const log = save.partyLogs.find((l) => l.id === logId)
    const next = confirmPartyLog(save, logId, new Date())
    if (log === undefined || next === save) return
    commitPartyGain(save, next)
    setNotice({
      id: Date.now(),
      text: `+${PARTY_QUEST_XP} Together XP: ${log.name}`,
      canUndo: false,
    })
  }

  // Logging a party quest: it now waits for the partner.
  function handleLogParty(questId: string) {
    if (save === null) return
    const next = logPartyQuest(save, questId, new Date())
    if (next === save) return
    commit(next)
    setNow(new Date())
    buzz('tap')
    setNotice({
      id: Date.now(),
      text: 'Logged. Send your share code from Camp.',
      canUndo: false,
    })
  }

  // A backup file was chosen and confirmed: use it as the save.
  function handleImport(imported: SaveData) {
    commit(imported)
    setScreen('village')
    setNotice({ id: Date.now(), text: 'Save imported', canUndo: false })
  }

  // First launch: ask who is playing (or bring in a backup).
  if (save === null) {
    return <PlayerPicker onPick={handlePick} onImport={handleImport} />
  }

  // The card on screen right now, if any.
  const card = celebrations[0]

  return (
    <>
      {saveFailed && (
        <p className="warning" role="alert">
          Could not save on this device. Your latest taps may be lost if you
          close the app.
        </p>
      )}

      {screen === 'village' && !historyOpen && (
        <Village
          save={save}
          now={now}
          onLog={handleLog}
          onDaily={handleDaily}
          onRemoveEntry={handleRemoveEntry}
          onLogParty={handleLogParty}
          onConfirmParty={handleConfirmParty}
          onOpenHistory={() => {
            setHistoryOpen(true)
            window.scrollTo(0, 0)
          }}
        />
      )}
      {screen === 'village' && historyOpen && (
        <History
          save={save}
          now={now}
          onBack={() => {
            setHistoryOpen(false)
            window.scrollTo(0, 0)
          }}
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
          onAddChallenge={(input) =>
            commitIfChanged(addChallenge(save, input, new Date()))
          }
          onUpdateChallenge={(challengeId, changes) =>
            commitIfChanged(updateChallenge(save, challengeId, changes))
          }
          onRemoveChallenge={(challengeId) =>
            commitIfChanged(removeChallenge(save, challengeId))
          }
          onAddEpic={(input) => commitIfChanged(addEpic(save, input, new Date()))}
          onUpdateEpic={(epicId, changes) =>
            commitIfChanged(updateEpic(save, epicId, changes))
          }
          onRemoveEpic={(epicId) => commitIfChanged(removeEpic(save, epicId))}
          onMilestone={handleMilestone}
          onLogParty={handleLogParty}
          onConfirmParty={handleConfirmParty}
          onDeclineParty={(logId) => commitIfChanged(declinePartyLog(save, logId))}
          onCancelParty={(logId) => commitIfChanged(cancelPartyLog(save, logId))}
          onAddPartyQuest={(name) =>
            commitIfChanged(addPartyQuest(save, name, new Date()))
          }
          onRemovePartyQuest={(questId) =>
            commitIfChanged(removePartyQuest(save, questId))
          }
        />
      )}
      {screen === 'map' && (
        <MapScreen
          save={save}
          now={now}
          onAddPin={(input) => commitIfChanged(addPin(save, input, new Date()))}
          onUpdatePin={(pinId, changes) =>
            commitIfChanged(updatePin(save, pinId, changes, new Date()))
          }
          onRemovePin={(pinId) => commitIfChanged(removePin(save, pinId))}
          onConfirmPin={(pinId) => commitIfChanged(confirmPin(save, pinId))}
          onDeclinePin={(pinId) => commitIfChanged(declinePin(save, pinId))}
          onAddExplorerQuests={() => {
            const next = addExplorerQuests(save, new Date())
            if (next === save) return
            commit(next)
            setNotice({
              id: Date.now(),
              text: 'Explorer party quests added to your Quests screen.',
              canUndo: false,
            })
          }}
        />
      )}
      {screen === 'camp' && (
        <Camp
          save={save}
          now={now}
          onImport={handleImport}
          onPartnerCode={handlePartnerCode}
        />
      )}

      <TabBar current={screen} onChange={handleChangeScreen} />

      {card !== undefined && card.kind === 'level' && (
        <CelebrationCard
          key={card.id}
          realm={card.realm}
          title="Level up!"
          onClose={closeCelebration}
        >
          <span className="celebration-line">
            {REALMS.find((r) => r.id === card.realm)?.name} reached{' '}
            <strong>level {card.level}</strong>
          </span>
          <span className="celebration-chip">
            Player level {playerLevel(save.realmXp)}
          </span>
        </CelebrationCard>
      )}

      {card !== undefined && card.kind === 'tier' && (
        <CelebrationCard
          key={card.id}
          realm={card.done.realm}
          title={card.done.allTiersDone ? 'Challenge complete!' : 'Tier complete!'}
          onClose={closeCelebration}
        >
          <span className="celebration-line">
            {card.done.challengeName}: <strong>{card.done.tierName}</strong>
          </span>
          <span className="celebration-chip">
            +{TIER_REWARD_XP} XP · +{TIER_REWARD_SKILL_POINTS} skill point
          </span>
        </CelebrationCard>
      )}

      {card !== undefined && card.kind === 'milestone' && (
        <CelebrationCard
          key={card.id}
          realm={card.realm}
          title={card.allDone ? 'Epic quest complete!' : 'Milestone reached!'}
          onClose={closeCelebration}
        >
          <span className="celebration-line">
            {card.epicName}: <strong>{card.milestoneName}</strong>
          </span>
          <span className="celebration-chip">+{EPIC_MILESTONE_XP} XP</span>
        </CelebrationCard>
      )}

      {card !== undefined && card.kind === 'map' && (
        <CelebrationCard
          key={card.id}
          realm="together"
          icon="map"
          title="Map milestone!"
          onClose={closeCelebration}
        >
          <span className="celebration-line">
            <strong>{card.name}</strong>
          </span>
          <span className="celebration-chip">{card.reward}</span>
        </CelebrationCard>
      )}

      {card !== undefined && card.kind === 'shield' && (
        <CelebrationCard
          key={card.id}
          realm={card.used.realm}
          icon="shield"
          title="Shield used"
          onClose={closeCelebration}
        >
          <span className="celebration-line">
            A shield covered a missed week in{' '}
            <strong>{card.used.challengeName}</strong>
          </span>
          <span className="celebration-chip">
            {save.shields} of {MAX_SHIELDS} shields left
          </span>
        </CelebrationCard>
      )}

      {notice !== null && (
        <div className="notice" role="status">
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
