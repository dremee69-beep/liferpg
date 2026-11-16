// EDITING YOUR DAILY QUESTS
// Add, rename and remove dailies. Like the other game files, these functions
// never change the save you give them: they hand back a fresh copy, or the
// very same save when the change is not allowed (so the caller can tell
// "nothing happened").

import { isDailyDoneToday } from './actions.ts'
import {
  isDailyXp,
  isPairRealm,
  MAX_DAILIES_PER_REALM,
  MAX_DAILY_NAME_LENGTH,
} from './rules.ts'
import type { RealmId } from './rules.ts'
import type { SaveData } from '../storage/save.ts'

// A daily as the screens need it: its name and whether it is done today.
export type DailyStatus = {
  id: string
  name: string
  xp: number
  doneToday: boolean
}

// One realm's dailies, each marked done or not done today.
export function dailyStatuses(
  save: SaveData,
  realm: RealmId,
  now: Date,
): DailyStatus[] {
  return save.dailies
    .filter((daily) => daily.realm === realm)
    .map((daily) => ({
      id: daily.id,
      name: daily.name,
      xp: daily.xp,
      doneToday: isDailyDoneToday(save, daily.id, now),
    }))
}

// Tidies a name someone typed: no spaces at the ends, not too long.
// Returns null when nothing is left (an empty name is not allowed).
export function cleanDailyName(typed: string): string | null {
  const name = typed.trim().slice(0, MAX_DAILY_NAME_LENGTH).trim()
  return name === '' ? null : name
}

function countInRealm(save: SaveData, realm: RealmId): number {
  return save.dailies.filter((daily) => daily.realm === realm).length
}

// Is there room for another daily in this realm? (Never in the pair realm:
// Together has party quests in place of dailies.)
export function canAddDaily(save: SaveData, realm: RealmId): boolean {
  if (isPairRealm(realm)) return false
  return countInRealm(save, realm) < MAX_DAILIES_PER_REALM
}

// A daily can be removed unless it is the last one left in its realm.
export function canRemoveDaily(save: SaveData, dailyId: string): boolean {
  const daily = save.dailies.find((d) => d.id === dailyId)
  return daily !== undefined && countInRealm(save, daily.realm) > 1
}

// Add a daily to a realm. `xp` is its size (10 or 25).
// `now` is only used to make a unique id.
export function addDaily(
  save: SaveData,
  realm: RealmId,
  typedName: string,
  xp: number,
  now: Date,
): SaveData {
  const name = cleanDailyName(typedName)
  if (name === null || !isDailyXp(xp) || !canAddDaily(save, realm)) return save

  // Build an id nothing else is using, e.g. "daily-mind-mh2k9x1a".
  let id = `daily-${realm}-${now.getTime().toString(36)}`
  while (save.dailies.some((daily) => daily.id === id)) {
    id = `${id}x`
  }

  return { ...save, dailies: [...save.dailies, { id, realm, name, xp }] }
}

// Change a daily's size between small (10 XP) and big (25 XP).
// Only future ticks are affected; XP already earned stays as it was.
export function setDailyXp(
  save: SaveData,
  dailyId: string,
  xp: number,
): SaveData {
  const daily = save.dailies.find((d) => d.id === dailyId)
  if (daily === undefined || !isDailyXp(xp) || daily.xp === xp) return save

  return {
    ...save,
    dailies: save.dailies.map((d) => (d.id === dailyId ? { ...d, xp } : d)),
  }
}

// Rename a daily. Its id stays the same, so past log entries and "done
// today" keep working under the new name.
export function renameDaily(
  save: SaveData,
  dailyId: string,
  typedName: string,
): SaveData {
  const name = cleanDailyName(typedName)
  const daily = save.dailies.find((d) => d.id === dailyId)
  if (name === null || daily === undefined || daily.name === name) return save

  return {
    ...save,
    dailies: save.dailies.map((d) => (d.id === dailyId ? { ...d, name } : d)),
  }
}

// Remove a daily from the list. XP already earned from it is kept, and its
// past entries stay in the log.
export function removeDaily(save: SaveData, dailyId: string): SaveData {
  if (!canRemoveDaily(save, dailyId)) return save
  return {
    ...save,
    dailies: save.dailies.filter((d) => d.id !== dailyId),
    // A challenge that counted only this daily now counts anything logged
    // in its realm, so it can still be completed.
    challenges: save.challenges.map((challenge) =>
      challenge.dailyId === dailyId ? { ...challenge, dailyId: null } : challenge,
    ),
  }
}
