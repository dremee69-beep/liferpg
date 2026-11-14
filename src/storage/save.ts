// SAVING AND LOADING
// This is the ONLY file that knows how progress is stored on the device.
// The rest of the app just calls loadSave() and writeSave().
//
// The save is kept in the browser's "localStorage": a small notebook the
// browser keeps for this app, on this device only. It stores text, so we turn
// the save into text (JSON) when writing and back into data when reading.

import { dayKey } from '../game/dates.ts'
import { DEFAULT_DAILIES, PLAYERS, REALMS } from '../game/rules.ts'
import type { PlayerId, RealmId } from '../game/rules.ts'
import type { RealmXp } from '../game/xp.ts'

// Bump this number whenever the shape of SaveData changes, and add a step to
// migrate() below so old saves are upgraded instead of lost.
//   Version 1: player, realm XP, log.
//   Version 2: adds the player's list of daily quests.
export const SAVE_VERSION = 2

// The names (keys) our data is filed under in the browser's notebook.
const SAVE_KEY = 'liferpg-save'
const BACKUP_KEY = 'liferpg-save-unreadable-backup'

// One logged action: which realm, how much XP, and when (ISO date text).
// If the action was ticking off a daily quest, dailyId says which one. That
// is how the app knows a daily is already done today.
export type LogEntry = {
  realm: RealmId
  xp: number
  at: string
  dailyId?: string
}

// One daily quest: a small repeatable action that can be ticked once a day.
export type Daily = {
  id: string
  realm: RealmId
  name: string
}

// Everything we remember about one player on this device.
export type SaveData = {
  version: number
  player: PlayerId
  realmXp: RealmXp
  log: LogEntry[]
  dailies: Daily[]
}

// A fresh copy of the starting daily quests.
function defaultDailies(): Daily[] {
  return DEFAULT_DAILIES.map((daily) => ({ ...daily }))
}

// The two things we need from the browser's storage. Spelling this out lets
// the tests pass in a pretend storage instead of a real browser.
export type KeyValueStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

// A brand new save: every realm at 0 XP, nothing logged yet.
export function newSave(player: PlayerId): SaveData {
  return {
    version: SAVE_VERSION,
    player,
    realmXp: { health: 0, mind: 0, wealth: 0, together: 0, questAbroad: 0 },
    log: [],
    dailies: defaultDailies(),
  }
}

// --- small helpers to check that loaded data is what we expect -------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isXpNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isRealmId(value: unknown): value is RealmId {
  return REALMS.some((realm) => realm.id === value)
}

function isPlayerId(value: unknown): value is PlayerId {
  return PLAYERS.some((player) => player.id === value)
}

// Upgrades an older save to the newest shape, one version at a time.
// Each step only ADDS what the newer version needs; it never throws away
// what the player already has.
function migrate(data: Record<string, unknown>): Record<string, unknown> {
  let upgraded = data

  // Version 1 -> 2: saves had no daily quests yet, so give them the starting
  // list. XP and the log are left exactly as they were.
  if (upgraded.version === 1) {
    upgraded = { ...upgraded, version: 2, dailies: defaultDailies() }
  }

  return upgraded
}

// Turns save-file text into SaveData. Returns null if the text is not a save
// we can understand (damaged, or made by a newer version of the app).
// Also used later for "Import save".
export function parseSave(text: string): SaveData | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null // not valid JSON at all
  }
  if (!isObject(raw)) return null
  if (typeof raw.version !== 'number') return null
  if (raw.version > SAVE_VERSION) return null // from a newer app: don't guess

  const data = migrate(raw)
  if (!isPlayerId(data.player)) return null

  // Read each realm's XP. A missing realm starts at 0 (useful if we ever add
  // a realm); a nonsense value means the save is damaged.
  const xpIn = isObject(data.realmXp) ? data.realmXp : {}
  const realmXp = newSave(data.player).realmXp
  for (const realm of REALMS) {
    const value = xpIn[realm.id]
    if (value === undefined) continue
    if (!isXpNumber(value)) return null
    realmXp[realm.id] = value
  }

  // Keep only log entries that look right.
  const log: LogEntry[] = []
  if (Array.isArray(data.log)) {
    for (const entry of data.log) {
      if (
        isObject(entry) &&
        isRealmId(entry.realm) &&
        isXpNumber(entry.xp) &&
        typeof entry.at === 'string'
      ) {
        const logEntry: LogEntry = {
          realm: entry.realm,
          xp: entry.xp,
          at: entry.at,
        }
        if (typeof entry.dailyId === 'string') logEntry.dailyId = entry.dailyId
        log.push(logEntry)
      }
    }
  }

  // The list of daily quests must be there; keep only entries that look right.
  if (!Array.isArray(data.dailies)) return null
  const dailies: Daily[] = []
  for (const daily of data.dailies) {
    if (
      isObject(daily) &&
      typeof daily.id === 'string' &&
      isRealmId(daily.realm) &&
      typeof daily.name === 'string'
    ) {
      dailies.push({ id: daily.id, realm: daily.realm, name: daily.name })
    }
  }

  return { version: SAVE_VERSION, player: data.player, realmXp, log, dailies }
}

// Asks the browser to treat our data as important, so it is not cleared when
// the phone runs low on space. The browser may say no; that is fine, the app
// still works, which is why weekly backups from Camp matter.
export async function askToKeepData(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Not supported here: nothing to do.
  }
}

// --- export / import --------------------------------------------------------

// The save as neatly laid-out text, ready to put in a backup file.
// parseSave() above is its opposite: it reads this text back in.
export function saveToText(save: SaveData): string {
  return JSON.stringify(save, null, 2)
}

// A file name for a backup, e.g. "liferpg-rachit-2026-11-14.txt".
// The date is the phone's local date, so backups sort nicely by day.
export function exportFileName(save: SaveData, now: Date): string {
  return `liferpg-${save.player}-${dayKey(now)}.txt`
}

// Reads the save from this device. Returns null when there is no save yet
// (first launch) or it cannot be read.
export function loadSave(store: KeyValueStore = localStorage): SaveData | null {
  try {
    const text = store.getItem(SAVE_KEY)
    if (text === null) return null // first launch

    const save = parseSave(text)
    if (save === null) {
      // Golden rule: never wipe progress. If we cannot read the save, keep a
      // copy of the raw text so it can be rescued before anything overwrites it.
      store.setItem(BACKUP_KEY, text)
    }
    return save
  } catch {
    return null // storage is blocked (e.g. some private browsing modes)
  }
}

// Writes the save to this device. Returns true if it worked.
export function writeSave(
  save: SaveData,
  store: KeyValueStore = localStorage,
): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false // storage full or blocked
  }
}
