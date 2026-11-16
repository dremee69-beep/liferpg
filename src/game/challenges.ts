// CHALLENGES
// A challenge is a chain of tiers in one realm. Each tier has a weekly
// target ("3 days a week for 2 weeks"). Weeks run Monday to Sunday.
//
// The player never taps anything for a challenge. The app counts active days
// from the log and, through settleChallenges() below, records each week's
// result and pays the reward when a tier is finished.
//
// Like the other game files, nothing here changes the save it is given: each
// function hands back a fresh copy, or the very same save when nothing changed.

import { addWeeks, dayKey, daysLeftInWeek, weekKey } from './dates.ts'
import {
  MAX_CHALLENGE_NAME_LENGTH,
  MAX_CHALLENGES,
  MAX_SHIELDS,
  MAX_TIER_WEEKS,
  MAX_TIERS,
  TIER_REWARD_SKILL_POINTS,
  TIER_REWARD_XP,
} from './rules.ts'
import type { RealmId } from './rules.ts'
import type { Challenge, ChallengeTier, SaveData } from '../storage/save.ts'

// What the player fills in to create a challenge.
export type ChallengeInput = {
  realm: RealmId
  name: string
  dailyId: string | null // one daily's id, or null for "anything in the realm"
  tiers: ChallengeTier[]
}

// Told to the screen when a tier has just been finished, so it can celebrate.
export type TierCompletion = {
  challengeId: string
  challengeName: string
  realm: RealmId
  tierName: string
  tierNumber: number // 1 for the first tier
  allTiersDone: boolean
}

// Told to the screen when a shield has just covered a missed week.
export type ShieldUse = {
  challengeId: string
  challengeName: string
  realm: RealmId
  week: string // the missed week (its Monday)
}

// ---------------------------------------------------------------------------
// Tidying what was typed
// ---------------------------------------------------------------------------

// Tidies a typed name. Returns null when nothing is left.
export function cleanChallengeName(typed: string): string | null {
  const name = typed.trim().slice(0, MAX_CHALLENGE_NAME_LENGTH).trim()
  return name === '' ? null : name
}

// Keeps a number whole and inside its allowed range, e.g. days from 1 to 7.
function clampWhole(value: number, lowest: number, highest: number): number {
  if (!Number.isFinite(value)) return lowest
  return Math.min(highest, Math.max(lowest, Math.round(value)))
}

// Tidies a list of tiers. A tier with no name is called "Tier 1", "Tier 2"...
// Returns null when there are no tiers, or too many.
export function cleanTiers(tiers: ChallengeTier[]): ChallengeTier[] | null {
  if (tiers.length === 0 || tiers.length > MAX_TIERS) return null
  return tiers.map((tier, index) => ({
    name: cleanChallengeName(tier.name) ?? `Tier ${index + 1}`,
    daysPerWeek: clampWhole(tier.daysPerWeek, 1, 7),
    weeks: clampWhole(tier.weeks, 1, MAX_TIER_WEEKS),
  }))
}

// A daily link is only kept if that daily exists in the challenge's realm.
function cleanDailyLink(
  save: SaveData,
  realm: RealmId,
  dailyId: string | null,
): string | null {
  const daily = save.dailies.find((d) => d.id === dailyId)
  return daily !== undefined && daily.realm === realm ? daily.id : null
}

// ---------------------------------------------------------------------------
// Adding, changing and removing
// ---------------------------------------------------------------------------

export function canAddChallenge(save: SaveData): boolean {
  return save.challenges.length < MAX_CHALLENGES
}

// Add a challenge. It starts on its first tier, and the week it is created
// in is the first week that counts.
export function addChallenge(
  save: SaveData,
  input: ChallengeInput,
  now: Date,
): SaveData {
  const name = cleanChallengeName(input.name)
  const tiers = cleanTiers(input.tiers)
  if (name === null || tiers === null || !canAddChallenge(save)) return save

  // Build an id nothing else is using.
  let id = `challenge-${input.realm}-${now.getTime().toString(36)}`
  while (save.challenges.some((challenge) => challenge.id === id)) {
    id = `${id}x`
  }

  const thisWeek = weekKey(now)
  const challenge: Challenge = {
    id,
    realm: input.realm,
    name,
    dailyId: cleanDailyLink(save, input.realm, input.dailyId),
    tiers,
    tierIndex: 0,
    weeksDone: 0,
    // "Last counted" is the week before, so this week is looked at first.
    lastCountedWeek: addWeeks(thisWeek, -1),
    startedWeek: thisWeek,
  }
  return { ...save, challenges: [...save.challenges, challenge] }
}

// Change a challenge's name, what counts, or its tiers.
// Tiers that are already finished are locked: only the tier in progress and
// the ones after it can be changed, added to or removed.
export function updateChallenge(
  save: SaveData,
  challengeId: string,
  changes: { name?: string; dailyId?: string | null; tiers?: ChallengeTier[] },
): SaveData {
  const old = save.challenges.find((c) => c.id === challengeId)
  if (old === undefined) return save

  const updated: Challenge = { ...old }

  if (changes.name !== undefined) {
    const name = cleanChallengeName(changes.name)
    if (name === null) return save
    updated.name = name
  }

  if (changes.dailyId !== undefined) {
    updated.dailyId = cleanDailyLink(save, old.realm, changes.dailyId)
  }

  if (changes.tiers !== undefined) {
    const tiers = cleanTiers(changes.tiers)
    // The new list must still contain every finished tier.
    if (tiers === null || tiers.length < old.tierIndex) return save
    updated.tiers = [
      ...old.tiers.slice(0, old.tierIndex), // finished tiers, untouched
      ...tiers.slice(old.tierIndex),
    ]
  }

  return {
    ...save,
    challenges: save.challenges.map((c) => (c.id === challengeId ? updated : c)),
  }
}

// Remove a challenge. XP and skill points it already earned are kept.
export function removeChallenge(save: SaveData, challengeId: string): SaveData {
  if (!save.challenges.some((c) => c.id === challengeId)) return save
  return {
    ...save,
    challenges: save.challenges.filter((c) => c.id !== challengeId),
  }
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

// How many different days in the given week (named by its Monday) the player
// was active for this challenge. Several entries on one day count once.
export function activeDaysInWeek(
  save: SaveData,
  challenge: Challenge,
  week: string,
): number {
  const days = new Set<string>()
  for (const entry of save.log) {
    // Reward entries are bonus XP, not something the player did.
    if (entry.challengeId !== undefined) continue

    const counts =
      challenge.dailyId === null
        ? entry.realm === challenge.realm // anything logged in the realm
        : entry.dailyId === challenge.dailyId // only that one daily
    if (!counts) continue

    const when = new Date(entry.at)
    if (weekKey(when) === week) days.add(dayKey(when))
  }
  return days.size
}

// ---------------------------------------------------------------------------
// Settling: recording each week's result and paying rewards
// ---------------------------------------------------------------------------

// Looks at every challenge and brings it up to date:
//   - a week where the target was reached is counted, the moment it is reached;
//     it also earns a shield;
//   - a past week that fell short uses a shield and counts anyway; with no
//     shield left it simply does not count, and has to be done again;
//   - when a tier has all its weeks, the reward is paid and the next tier opens.
// Once a week has been counted it stays counted, even if a log entry from
// that week is removed later.
//
// Safe to call as often as you like: with nothing new, it changes nothing and
// hands back the very same save.
export function settleChallenges(
  save: SaveData,
  now: Date,
): { save: SaveData; completed: TierCompletion[]; shieldsUsed: ShieldUse[] } {
  const thisWeek = weekKey(now)
  const completed: TierCompletion[] = []
  const shieldsUsed: ShieldUse[] = []

  // Working copies that we are free to change.
  const realmXp = { ...save.realmXp }
  const skillPoints = { ...save.skillPoints }
  const log = [...save.log]
  let changed = false

  let shields = save.shields
  const challenges = save.challenges.map((original) => ({ ...original }))

  // While the tier in progress has all its weeks: pay its reward and move
  // to the next tier. (Also catches a tier that was edited to need fewer
  // weeks than are already done.)
  function finishFullTiers(challenge: Challenge) {
    while (
      challenge.tierIndex < challenge.tiers.length &&
      challenge.weeksDone >= challenge.tiers[challenge.tierIndex].weeks
    ) {
      const tier = challenge.tiers[challenge.tierIndex]
      realmXp[challenge.realm] += TIER_REWARD_XP
      skillPoints[challenge.realm] += TIER_REWARD_SKILL_POINTS
      log.push({
        realm: challenge.realm,
        xp: TIER_REWARD_XP,
        at: now.toISOString(),
        challengeId: challenge.id,
      })
      challenge.tierIndex += 1
      challenge.weeksDone = 0
      completed.push({
        challengeId: challenge.id,
        challengeName: challenge.name,
        realm: challenge.realm,
        tierName: tier.name,
        tierNumber: challenge.tierIndex,
        allTiersDone: challenge.tierIndex >= challenge.tiers.length,
      })
      changed = true
    }
  }

  // The next week whose result can be recorded for a challenge, and whether
  // the target was reached in it. Null when there is nothing to record yet.
  function nextWeekToRecord(
    challenge: Challenge,
  ): { week: string; onTarget: boolean } | null {
    if (challenge.tierIndex >= challenge.tiers.length) return null // all done
    const week = addWeeks(challenge.lastCountedWeek, 1)
    if (week > thisWeek) return null // nothing new to look at yet

    const tier = challenge.tiers[challenge.tierIndex]
    const onTarget = activeDaysInWeek(save, challenge, week) >= tier.daysPerWeek
    // This week, target not reached yet: wait and see.
    if (!onTarget && week === thisWeek) return null
    return { week, onTarget }
  }

  for (const challenge of challenges) finishFullTiers(challenge)

  // Record one week of one challenge at a time, OLDEST WEEK FIRST across
  // all challenges, so a shield earned in one week can cover a miss in a
  // later one. Inside the same week, weeks on target go first (shields are
  // earned before they are spent), then the order of the player's list.
  // The counter is only a safety stop for very old saves.
  for (let step = 0; step < 10_000; step++) {
    let pick: { challenge: Challenge; week: string; onTarget: boolean } | null =
      null
    for (const challenge of challenges) {
      const next = nextWeekToRecord(challenge)
      if (next === null) continue
      if (
        pick === null ||
        next.week < pick.week ||
        (next.week === pick.week && next.onTarget && !pick.onTarget)
      ) {
        pick = { challenge, ...next }
      }
    }
    if (pick === null) break // everything is up to date

    const { challenge, week, onTarget } = pick
    challenge.lastCountedWeek = week
    changed = true

    if (onTarget) {
      // Target reached: the week counts (even if it is still this week),
      // and it earns a shield, unless the player already holds the most.
      challenge.weeksDone += 1
      shields = Math.min(MAX_SHIELDS, shields + 1)
    } else if (week === challenge.startedWeek || week < save.shieldsFrom) {
      // A free pass: the part-week the challenge was created in, or a week
      // from before shields existed. It does not count and costs nothing.
    } else if (shields > 0) {
      // A missed week, and there is a shield: it is used, and the week
      // counts as done. A note goes in the log so you can look back at it.
      shields -= 1
      challenge.weeksDone += 1
      log.push({
        realm: challenge.realm,
        xp: 0,
        at: now.toISOString(),
        challengeId: challenge.id,
        shield: true,
      })
      shieldsUsed.push({
        challengeId: challenge.id,
        challengeName: challenge.name,
        realm: challenge.realm,
        week,
      })
    }
    // Otherwise: a missed week and no shield. It does not count, so the
    // tier needs one more week. Nothing already earned is taken away.

    finishFullTiers(challenge)
  }

  if (!changed) return { save, completed, shieldsUsed }
  return {
    save: { ...save, realmXp, skillPoints, log, challenges, shields },
    completed,
    shieldsUsed,
  }
}

// ---------------------------------------------------------------------------
// What the screens show
// ---------------------------------------------------------------------------

export type ChallengeView = {
  id: string
  realm: RealmId
  name: string
  countsLabel: string // e.g. 'Counts: Did a workout today'
  allTiersDone: boolean
  tierCount: number
  // Everything below describes the tier in progress (empty when all done).
  tierNumber: number // 1 for the first tier
  tierName: string
  daysThisWeek: number
  daysTarget: number
  weekCounted: boolean // this week has already been counted as on target
  // True just after a tier is finished: this week belonged to the tier
  // before, so the tier in progress starts counting next Monday.
  startsNextWeek: boolean
  weeksDone: number
  weeksTarget: number
  daysLeftThisWeek: number // counting today
}

// Everything a screen needs to draw one challenge.
// Call settleChallenges() first, so the numbers are up to date.
export function challengeView(
  save: SaveData,
  challenge: Challenge,
  now: Date,
): ChallengeView {
  const daily = save.dailies.find((d) => d.id === challenge.dailyId)
  const allTiersDone = challenge.tierIndex >= challenge.tiers.length
  const tier = allTiersDone ? undefined : challenge.tiers[challenge.tierIndex]
  const thisWeek = weekKey(now)
  const weekCounted = challenge.lastCountedWeek === thisWeek

  return {
    id: challenge.id,
    realm: challenge.realm,
    name: challenge.name,
    countsLabel:
      daily !== undefined
        ? `Counts: ${daily.name}`
        : 'Counts: anything logged in this realm',
    allTiersDone,
    tierCount: challenge.tiers.length,
    tierNumber: allTiersDone ? challenge.tiers.length : challenge.tierIndex + 1,
    tierName: tier?.name ?? '',
    daysThisWeek: activeDaysInWeek(save, challenge, thisWeek),
    daysTarget: tier?.daysPerWeek ?? 0,
    weekCounted,
    // This week is used up, yet this tier has no weeks: it was the last
    // tier's week.
    startsNextWeek: !allTiersDone && weekCounted && challenge.weeksDone === 0,
    weeksDone: challenge.weeksDone,
    weeksTarget: tier?.weeks ?? 0,
    daysLeftThisWeek: daysLeftInWeek(now),
  }
}
