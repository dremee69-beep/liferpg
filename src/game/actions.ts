// ACTIONS
// What happens to a save when the player does something.
// These functions never change the save you give them: they return a fresh
// copy with the change applied. That keeps React (and undo) simple and safe.

import { dayKey } from './dates.ts'
import { untickMilestone } from './epics.ts'
import type { RealmId } from './rules.ts'
import type { SaveData } from '../storage/save.ts'

// Log one action: add the XP to the realm and write a line in the log.
export function logAction(
  save: SaveData,
  realm: RealmId,
  xp: number,
  now: Date,
): SaveData {
  return {
    ...save,
    realmXp: { ...save.realmXp, [realm]: save.realmXp[realm] + xp },
    log: [...save.log, { realm, xp, at: now.toISOString() }],
  }
}

// Has this daily quest already been ticked today?
// We look through the log for an entry for this daily made on today's date.
export function isDailyDoneToday(
  save: SaveData,
  dailyId: string,
  now: Date,
): boolean {
  const today = dayKey(now)
  return save.log.some(
    (entry) => entry.dailyId === dailyId && dayKey(new Date(entry.at)) === today,
  )
}

// Tick off a daily quest: gives that daily's own XP (10 or 25) and notes it
// in the log. The log remembers the amount given, so changing a daily's size
// later never rewrites what past ticks were worth.
// Does nothing if the daily does not exist or is already done today.
export function completeDaily(
  save: SaveData,
  dailyId: string,
  now: Date,
): SaveData {
  const daily = save.dailies.find((d) => d.id === dailyId)
  if (daily === undefined) return save
  if (isDailyDoneToday(save, dailyId, now)) return save

  return {
    ...save,
    realmXp: {
      ...save.realmXp,
      [daily.realm]: save.realmXp[daily.realm] + daily.xp,
    },
    log: [
      ...save.log,
      { realm: daily.realm, xp: daily.xp, at: now.toISOString(), dailyId },
    ],
  }
}

// Remove one entry from the log and take its XP back.
// `index` is the entry's position in save.log (0 is the oldest entry).
// Because "done today" is worked out from the log, removing a daily's entry
// also makes that daily tickable again.
export function removeLogEntry(save: SaveData, index: number): SaveData {
  const entry = save.log[index]
  if (entry === undefined) return save // no such entry: change nothing
  // A challenge reward goes with a finished tier, so it cannot be removed
  // on its own.
  if (entry.challengeId !== undefined) return save
  // A party quest's XP was agreed by both players, so it stays too.
  if (entry.partyId !== undefined) return save
  // Removing a milestone's entry also unticks that milestone.
  if (entry.milestoneId !== undefined) {
    save = untickMilestone(save, entry.milestoneId)
  }
  return {
    ...save,
    realmXp: {
      ...save.realmXp,
      // Math.max stops XP from ever going below zero.
      [entry.realm]: Math.max(0, save.realmXp[entry.realm] - entry.xp),
    },
    // Keep every entry except the one at `index`.
    log: save.log.filter((_, position) => position !== index),
  }
}

// Undo the most recent action (for instant mis-taps).
// With an empty log there is nothing to undo.
// If that action also finished a challenge tier, the reward entry sits after
// it in the log; we skip past rewards and take back the player's own action.
export function undoLastAction(save: SaveData): SaveData {
  for (let index = save.log.length - 1; index >= 0; index--) {
    const entry = save.log[index]
    // Rewards and party quest XP are not the player's own taps: skip them.
    if (entry.challengeId === undefined && entry.partyId === undefined) {
      return removeLogEntry(save, index)
    }
  }
  return save
}
