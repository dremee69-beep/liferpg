// XP AND LEVEL MATHS
// Pure calculations only: give these functions numbers, get numbers back.
// Nothing here touches the screen or the save file, which makes it easy to test.

import { REALMS, XP_STEP_PER_LEVEL } from './rules.ts'
import type { RealmId } from './rules.ts'

// How much XP each realm has, e.g. { health: 120, mind: 0, ... }
export type RealmXp = Record<RealmId, number>

// Total XP needed to REACH a level.
// Rulebook formula: 50 x n x (n - 1)  ->  L1 = 0, L2 = 100, L3 = 300, L4 = 600
export function totalXpForLevel(level: number): number {
  return (XP_STEP_PER_LEVEL / 2) * level * (level - 1)
}

// Which level a realm is at for a given XP total.
// We start at level 1 and keep climbing while we can afford the next level.
export function levelForXp(xp: number): number {
  let level = 1
  while (xp >= totalXpForLevel(level + 1)) {
    level = level + 1
  }
  return level
}

// Everything the XP bar needs to draw itself.
export function levelProgress(xp: number) {
  const level = levelForXp(xp)
  const levelStart = totalXpForLevel(level) // XP where this level began
  const nextLevelAt = totalXpForLevel(level + 1) // XP where the next one begins
  return {
    level,
    xpIntoLevel: xp - levelStart, // how much of the bar is filled
    xpForThisLevel: nextLevelAt - levelStart, // how long the whole bar is
  }
}

// Player level = the sum of your realm levels minus 4.
// With five realms at level 1 that is 5 - 4 = 1, and every realm level-up adds 1.
export function playerLevel(realmXp: RealmXp): number {
  let sum = 0
  for (const realm of REALMS) {
    sum = sum + levelForXp(realmXp[realm.id])
  }
  return sum - (REALMS.length - 1)
}
