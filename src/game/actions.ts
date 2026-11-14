// ACTIONS
// What happens to a save when the player does something.
// These functions never change the save you give them: they return a fresh
// copy with the change applied. That keeps React (and undo) simple and safe.

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

// Undo the most recent action (for mis-taps): remove the last log line and
// take its XP back. With an empty log there is nothing to undo.
export function undoLastAction(save: SaveData): SaveData {
  const last = save.log[save.log.length - 1]
  if (last === undefined) return save
  return {
    ...save,
    realmXp: {
      ...save.realmXp,
      [last.realm]: Math.max(0, save.realmXp[last.realm] - last.xp),
    },
    log: save.log.slice(0, -1),
  }
}
