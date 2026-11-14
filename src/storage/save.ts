// SAVING AND LOADING
// This is the ONLY file that knows how progress is stored on the device.
// The rest of the app just calls loadSave() and writeSave().
//
// The save is kept in the browser's "localStorage": a small notebook the
// browser keeps for this app, on this device only. It stores text, so we turn
// the save into text (JSON) when writing and back into data when reading.

import { PLAYERS, REALMS } from '../game/rules.ts'
import type { PlayerId, RealmId } from '../game/rules.ts'
import type { RealmXp } from '../game/xp.ts'

// Bump this number whenever the shape of SaveData changes, and add a step to
// migrate() below so old saves are upgraded instead of lost.
export const SAVE_VERSION = 1

// The names (keys) our data is filed under in the browser's notebook.
const SAVE_KEY = 'liferpg-save'
const BACKUP_KEY = 'liferpg-save-unreadable-backup'

// One logged action: which realm, how much XP, and when (ISO date text).
export type LogEntry = {
  realm: RealmId
  xp: number
  at: string
}

// Everything we remember about one player on this device.
export type SaveData = {
  version: number
  player: PlayerId
  realmXp: RealmXp
  log: LogEntry[]
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
// There is only version 1 so far, so there is nothing to upgrade yet.
// Example for the future:
//   if (data.version === 1) { data.shields = 1; data.version = 2 }
function migrate(data: Record<string, unknown>): Record<string, unknown> {
  return data
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
        log.push({ realm: entry.realm, xp: entry.xp, at: entry.at })
      }
    }
  }

  return { version: SAVE_VERSION, player: data.player, realmXp, log }
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
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `liferpg-${save.player}-${year}-${month}-${day}.txt`
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
