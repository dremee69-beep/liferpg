// TESTS for challenges: weeks, counting, tiers and rewards.
// Run them with:  npm test
//
// The calendar used here: Monday 9 November 2026 starts a week.
//   Mon 9, Tue 10, Wed 11, Thu 12, Fri 13, Sat 14, Sun 15
//   Mon 16 ... Sun 22,  Mon 23 ... Sun 29

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  completeDaily,
  logAction,
  removeLogEntry,
  undoLastAction,
} from '../src/game/actions.ts'
import {
  activeDaysInWeek,
  addChallenge,
  challengeView,
  cleanTiers,
  removeChallenge,
  settleChallenges,
  updateChallenge,
} from '../src/game/challenges.ts'
import { addDaily, removeDaily } from '../src/game/dailies.ts'
import {
  addWeeks,
  dateFromDayKey,
  dayKey,
  daysLeftInWeek,
  weekKey,
} from '../src/game/dates.ts'
import { EXAMPLE_CHALLENGE, MAX_CHALLENGES } from '../src/game/rules.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'
import type { ChallengeTier, SaveData } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

const WORKOUT = 'daily-health-1'
const threeDaysTwoWeeks: ChallengeTier[] = [
  { name: 'Getting Moving', daysPerWeek: 3, weeks: 2 },
  { name: 'Habit Forming', daysPerWeek: 4, weeks: 3 },
]

// A fresh save with one Health challenge, created on Monday 9 November.
function startChallenge(tiers = threeDaysTwoWeeks, dailyId: string | null = WORKOUT) {
  return addChallenge(
    newSave('rachit'),
    { realm: 'health', name: 'Movement', dailyId, tiers },
    nov(9),
  )
}

// Tick the workout daily on each of the given days.
function workOutOn(save: SaveData, ...days: number[]): SaveData {
  for (const day of days) save = completeDaily(save, WORKOUT, nov(day))
  return save
}

// Settle and keep only the save.
function settle(save: SaveData, now: Date): SaveData {
  return settleChallenges(save, now).save
}

// ----- weeks ---------------------------------------------------------------

test('a week runs Monday to Sunday and is named by its Monday', () => {
  assert.equal(weekKey(nov(9)), '2026-11-09') // Monday
  assert.equal(weekKey(nov(14)), '2026-11-09') // Saturday
  assert.equal(weekKey(nov(15, 23)), '2026-11-09') // Sunday night
  assert.equal(weekKey(nov(16, 0)), '2026-11-16') // next Monday
})

test('weeks can be stepped forward and back, across a new year too', () => {
  assert.equal(addWeeks('2026-11-09', 1), '2026-11-16')
  assert.equal(addWeeks('2026-11-09', -1), '2026-11-02')
  assert.equal(addWeeks('2026-12-28', 1), '2027-01-04')
  assert.equal(dayKey(dateFromDayKey('2026-11-09')), '2026-11-09')
})

test('days left in the week count today', () => {
  assert.equal(daysLeftInWeek(nov(9)), 7) // Monday
  assert.equal(daysLeftInWeek(nov(15)), 1) // Sunday
})

// ----- adding --------------------------------------------------------------

test('a new challenge starts on its first tier with nothing counted', () => {
  const challenge = startChallenge().challenges[0]

  assert.equal(challenge.name, 'Movement')
  assert.equal(challenge.tierIndex, 0)
  assert.equal(challenge.weeksDone, 0)
  assert.equal(challenge.startedWeek, '2026-11-09')
  assert.equal(challenge.lastCountedWeek, '2026-11-02') // the week before
})

test('typed tiers are tidied into sensible numbers', () => {
  assert.deepEqual(
    cleanTiers([
      { name: '  ', daysPerWeek: 99, weeks: 0 },
      { name: ' Push ', daysPerWeek: 2.4, weeks: 500 },
    ]),
    [
      { name: 'Tier 1', daysPerWeek: 7, weeks: 1 },
      { name: 'Push', daysPerWeek: 2, weeks: 12 },
    ],
  )
  assert.equal(cleanTiers([]), null)
})

test('a challenge needs a name and at least one tier', () => {
  const save = newSave('rachit')
  const input = { realm: 'health', dailyId: null } as const

  assert.equal(addChallenge(save, { ...input, name: '  ', tiers: threeDaysTwoWeeks }, nov(9)), save)
  assert.equal(addChallenge(save, { ...input, name: 'Movement', tiers: [] }, nov(9)), save)
})

test('a challenge can only be linked to a daily in its own realm', () => {
  const save = addChallenge(
    newSave('rachit'),
    { realm: 'health', name: 'Movement', dailyId: 'daily-mind-1', tiers: threeDaysTwoWeeks },
    nov(9),
  )
  assert.equal(save.challenges[0].dailyId, null)
})

test('the rulebook example can be added as it is', () => {
  const save = addChallenge(
    newSave('deepika'),
    {
      realm: EXAMPLE_CHALLENGE.realm,
      name: EXAMPLE_CHALLENGE.name,
      dailyId: WORKOUT,
      tiers: EXAMPLE_CHALLENGE.tiers.map((tier) => ({ ...tier })),
    },
    nov(9),
  )
  assert.equal(save.challenges[0].tiers.length, 3)
  assert.equal(save.challenges[0].tiers[2].daysPerWeek, 5)
})

test('there is a limit on how many challenges you can have', () => {
  let save = newSave('rachit')
  for (let i = 0; i < MAX_CHALLENGES + 3; i++) {
    save = addChallenge(
      save,
      { realm: 'mind', name: `Challenge ${i}`, dailyId: null, tiers: threeDaysTwoWeeks },
      nov(9),
    )
  }
  assert.equal(save.challenges.length, MAX_CHALLENGES)
  // Every one got its own id, even though they were made at the same instant.
  assert.equal(new Set(save.challenges.map((c) => c.id)).size, MAX_CHALLENGES)
})

// ----- counting ------------------------------------------------------------

test('several entries on one day count as one active day', () => {
  let save = startChallenge(threeDaysTwoWeeks, null) // anything in Health counts
  save = logAction(save, 'health', 10, nov(9, 8))
  save = logAction(save, 'health', 25, nov(9, 19))
  save = logAction(save, 'health', 10, nov(10))

  assert.equal(activeDaysInWeek(save, save.challenges[0], '2026-11-09'), 2)
})

test('a challenge linked to a daily counts only that daily', () => {
  let save = startChallenge() // linked to the workout daily
  save = logAction(save, 'health', 25, nov(9)) // a plain Health action
  save = completeDaily(save, WORKOUT, nov(10))

  assert.equal(activeDaysInWeek(save, save.challenges[0], '2026-11-09'), 1)
})

test('a challenge with no link counts anything logged in its realm', () => {
  let save = startChallenge(threeDaysTwoWeeks, null)
  save = logAction(save, 'health', 25, nov(9))
  save = completeDaily(save, WORKOUT, nov(10))
  save = logAction(save, 'mind', 25, nov(11)) // another realm: does not count

  assert.equal(activeDaysInWeek(save, save.challenges[0], '2026-11-09'), 2)
})

test('activity in another week is not counted', () => {
  const save = workOutOn(startChallenge(), 9, 10, 16)
  assert.equal(activeDaysInWeek(save, save.challenges[0], '2026-11-09'), 2)
  assert.equal(activeDaysInWeek(save, save.challenges[0], '2026-11-16'), 1)
})

// ----- weeks and tiers -----------------------------------------------------

test('a week is counted the moment its target is reached', () => {
  let save = workOutOn(startChallenge(), 9, 10)
  save = settle(save, nov(10))
  assert.equal(save.challenges[0].weeksDone, 0) // 2 of 3 days: not yet

  save = workOutOn(save, 11)
  save = settle(save, nov(11)) // Wednesday: no need to wait for Sunday
  assert.equal(save.challenges[0].weeksDone, 1)
  assert.equal(save.challenges[0].lastCountedWeek, '2026-11-09')
})

test('extra days in a counted week do not count twice', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = workOutOn(save, 12, 13)

  const again = settleChallenges(save, nov(13))
  assert.equal(again.save, save) // nothing new: the very same save comes back
  assert.equal(again.save.challenges[0].weeksDone, 1)
})

test('finishing a tier pays 50 XP and 1 skill point and opens the next tier', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = workOutOn(save, 16, 17, 18)
  const result = settleChallenges(save, nov(18))
  save = result.save

  // Six workouts at 10 XP, plus the 50 XP tier reward.
  assert.equal(save.realmXp.health, 110)
  assert.equal(save.skillPoints.health, 1)
  assert.equal(save.skillPoints.mind, 0)

  const challenge = save.challenges[0]
  assert.equal(challenge.tierIndex, 1)
  assert.equal(challenge.weeksDone, 0)

  // The reward is written in the log, marked as belonging to the challenge.
  const reward = save.log[save.log.length - 1]
  assert.equal(reward.xp, 50)
  assert.equal(reward.challengeId, challenge.id)

  // And the screen is told, so it can celebrate.
  assert.deepEqual(result.completed, [
    {
      challengeId: challenge.id,
      challengeName: 'Movement',
      realm: 'health',
      tierName: 'Getting Moving',
      tierNumber: 1,
      allTiersDone: false,
    },
  ])
})

test('settling again pays nothing extra', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18))

  const again = settleChallenges(save, nov(19))
  assert.equal(again.save, save)
  assert.deepEqual(again.completed, [])
  assert.equal(again.save.skillPoints.health, 1)
})

test('the next tier starts counting from the following week', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18)) // tier 1 done on Wed 18

  // Four more workouts in that same week would meet tier 2's target of 4,
  // but that week already belongs to tier 1.
  save = settle(workOutOn(save, 19, 20, 21, 22), nov(22))
  assert.equal(save.challenges[0].tierIndex, 1)
  assert.equal(save.challenges[0].weeksDone, 0)

  // The week after, the same effort does count.
  save = settle(workOutOn(save, 23, 24, 25, 26), nov(26))
  assert.equal(save.challenges[0].weeksDone, 1)
})

test('with no shield, a missed week does not count, and nothing is lost or reset', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11)) // week 1: on target
  save = { ...save, shields: 0 } // pretend the shields are already used up
  save = workOutOn(save, 16) // week 2: only 1 day

  save = settle(save, nov(23)) // looked at on the Monday after
  assert.equal(save.challenges[0].tierIndex, 0)
  assert.equal(save.challenges[0].weeksDone, 1) // week 1 is still counted
  assert.equal(save.challenges[0].lastCountedWeek, '2026-11-16')
  assert.equal(save.skillPoints.health, 0)

  // Week 3 on target finishes the tier: the missed week only cost time.
  save = settle(workOutOn(save, 23, 24, 25), nov(25))
  assert.equal(save.challenges[0].tierIndex, 1)
})

test('this week is never marked as missed while it is still running', () => {
  const save = workOutOn(startChallenge(), 9)
  const result = settleChallenges(save, nov(15, 23)) // Sunday night, 1 of 3 days
  assert.equal(result.save, save) // still waiting
})

test('a partial first week that falls short costs nothing', () => {
  // Created on Friday 13th: only three days of the week are left.
  let save = addChallenge(
    newSave('deepika'),
    { realm: 'health', name: 'Movement', dailyId: WORKOUT, tiers: threeDaysTwoWeeks },
    nov(13),
  )
  save = workOutOn(save, 14)
  save = settle(save, nov(16))

  assert.equal(save.challenges[0].weeksDone, 0)
  assert.equal(save.challenges[0].tierIndex, 0)
})

test('coming back after months away catches up without trouble', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  const muchLater = new Date(2027, 5, 16, 9, 0) // Wednesday 16 June 2027

  save = settle(save, muchLater)
  // Week 1 earned a second shield. The two shields covered the first two
  // missed weeks: one finished tier 1, one counted towards tier 2. After
  // that the shields were gone and the missed weeks simply did not count.
  assert.equal(save.shields, 0)
  assert.equal(save.challenges[0].tierIndex, 1)
  assert.equal(save.challenges[0].weeksDone, 1)
  assert.equal(save.challenges[0].lastCountedWeek, '2027-06-07') // last full week
})

test('finishing the last tier completes the challenge', () => {
  const oneTier = [{ name: 'Just once', daysPerWeek: 1, weeks: 1 }]
  let save = workOutOn(startChallenge(oneTier), 9)
  const result = settleChallenges(save, nov(9))
  save = result.save

  assert.equal(result.completed[0].allTiersDone, true)
  assert.equal(challengeView(save, save.challenges[0], nov(9)).allTiersDone, true)

  // More workouts change nothing once every tier is done.
  const later = settleChallenges(workOutOn(save, 16), nov(16))
  assert.deepEqual(later.completed, [])
  assert.equal(later.save.skillPoints.health, 1)
})

// ----- editing -------------------------------------------------------------

test('adding a tier to a finished challenge brings it back to life', () => {
  const oneTier = [{ name: 'Just once', daysPerWeek: 1, weeks: 1 }]
  let save = settle(workOutOn(startChallenge(oneTier), 9), nov(9))
  const id = save.challenges[0].id

  save = updateChallenge(save, id, {
    tiers: [...oneTier, { name: 'Again', daysPerWeek: 2, weeks: 1 }],
  })
  assert.equal(challengeView(save, save.challenges[0], nov(10)).allTiersDone, false)

  save = settle(workOutOn(save, 16, 17), nov(17))
  assert.equal(save.skillPoints.health, 2)
})

test('finished tiers are locked when editing', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18)) // tier 1 finished
  const id = save.challenges[0].id

  // Try to rewrite tier 1 and change tier 2.
  const edited = updateChallenge(save, id, {
    tiers: [
      { name: 'Rewritten', daysPerWeek: 1, weeks: 1 },
      { name: 'Easier', daysPerWeek: 2, weeks: 2 },
    ],
  })
  assert.equal(edited.challenges[0].tiers[0].name, 'Getting Moving') // locked
  assert.equal(edited.challenges[0].tiers[1].name, 'Easier') // changed

  // A list that drops a finished tier is refused.
  assert.equal(updateChallenge(save, id, { tiers: [] }), save)
})

test('shortening the tier in progress can finish it', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11)) // 1 of 2 weeks
  const id = save.challenges[0].id

  save = updateChallenge(save, id, {
    tiers: [{ name: 'Getting Moving', daysPerWeek: 3, weeks: 1 }],
  })
  const result = settleChallenges(save, nov(12))
  assert.equal(result.completed.length, 1)
  assert.equal(result.save.skillPoints.health, 1)
})

test('a challenge can be renamed and re-linked', () => {
  let save = startChallenge()
  const id = save.challenges[0].id

  save = updateChallenge(save, id, { name: '  Keep moving ', dailyId: null })
  assert.equal(save.challenges[0].name, 'Keep moving')
  assert.equal(save.challenges[0].dailyId, null)

  assert.equal(updateChallenge(save, id, { name: '   ' }), save) // empty: refused
  assert.equal(updateChallenge(save, 'no-such-id', { name: 'X' }), save)
})

test('removing a challenge keeps what it already earned', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18))
  save = removeChallenge(save, save.challenges[0].id)

  assert.equal(save.challenges.length, 0)
  assert.equal(save.realmXp.health, 110)
  assert.equal(save.skillPoints.health, 1)
})

test('removing the linked daily switches the challenge to "anything in the realm"', () => {
  let save = addDaily(startChallenge(), 'health', 'Stretch', 10, nov(9))
  save = removeDaily(save, WORKOUT)
  assert.equal(save.challenges[0].dailyId, null)
})

// ----- rewards in the log --------------------------------------------------

test('a tier reward cannot be removed by hand', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18))

  const rewardPosition = save.log.length - 1
  assert.equal(removeLogEntry(save, rewardPosition), save)
})

test('undo after a tier-finishing tap takes back the tap, not the reward', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18)) // the 18th finished the tier
  assert.equal(save.realmXp.health, 110)

  save = undoLastAction(save)
  assert.equal(save.realmXp.health, 100) // the workout's 10 XP is gone
  assert.equal(save.log[save.log.length - 1].xp, 50) // the reward is still there
  assert.equal(save.challenges[0].tierIndex, 1) // a counted week stays counted
})

test('reward XP does not count as activity', () => {
  // "Anything in the realm" challenge with a one-day tier, then a second tier.
  const tiers = [
    { name: 'One', daysPerWeek: 1, weeks: 1 },
    { name: 'Two', daysPerWeek: 1, weeks: 1 },
  ]
  let save = startChallenge(tiers, null)
  save = settle(logAction(save, 'health', 10, nov(9)), nov(9)) // tier 1 done

  // Next week, with no activity at all, the reward entry must not count.
  save = settle(save, nov(22, 23))
  assert.equal(save.challenges[0].tierIndex, 1)
  assert.equal(save.challenges[0].weeksDone, 0)
})

// ----- what the screen shows -----------------------------------------------

test('the view describes the tier in progress', () => {
  const save = settle(workOutOn(startChallenge(), 9, 10), nov(10))
  const view = challengeView(save, save.challenges[0], nov(10)) // a Tuesday

  assert.equal(view.name, 'Movement')
  assert.equal(view.countsLabel, 'Counts: Did a workout today')
  assert.equal(view.tierNumber, 1)
  assert.equal(view.tierCount, 2)
  assert.equal(view.tierName, 'Getting Moving')
  assert.equal(view.daysThisWeek, 2)
  assert.equal(view.daysTarget, 3)
  assert.equal(view.weekCounted, false)
  assert.equal(view.weeksDone, 0)
  assert.equal(view.weeksTarget, 2)
  assert.equal(view.daysLeftThisWeek, 6)
})

test('right after a tier is finished, the next tier starts on Monday', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18)) // tier 1 done on Wed 18

  const sameWeek = challengeView(save, save.challenges[0], nov(19))
  assert.equal(sameWeek.tierNumber, 2)
  assert.equal(sameWeek.startsNextWeek, true)

  const nextWeek = challengeView(save, save.challenges[0], nov(23))
  assert.equal(nextWeek.startsNextWeek, false)
})

test('the view shows when this week is already in the bag', () => {
  const save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  const view = challengeView(save, save.challenges[0], nov(12))
  assert.equal(view.weekCounted, true)
  assert.equal(view.startsNextWeek, false) // this week belongs to this tier
  assert.equal(view.weeksDone, 1)
})

// ----- saving --------------------------------------------------------------

test('a version 3 save is upgraded with no challenges and no skill points', () => {
  const oldSave = JSON.stringify({
    version: 3,
    player: 'rachit',
    realmXp: { health: 210, mind: 40, wealth: 0, together: 0, questAbroad: 0 },
    log: [{ realm: 'health', xp: 25, at: '2026-11-14T07:00:00.000Z', dailyId: WORKOUT }],
    dailies: [{ id: WORKOUT, realm: 'health', name: 'Full workout', xp: 25 }],
  })

  const upgraded = parseSave(oldSave)
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.equal(upgraded?.realmXp.health, 210)
  assert.equal(upgraded?.log.length, 1)
  assert.deepEqual(upgraded?.dailies, [
    { id: WORKOUT, realm: 'health', name: 'Full workout', xp: 25 },
  ])
  assert.deepEqual(upgraded?.challenges, [])
  assert.deepEqual(upgraded?.skillPoints, {
    health: 0,
    mind: 0,
    wealth: 0,
    together: 0,
    questAbroad: 0,
  })
})

test('challenges, rewards and skill points survive export and import', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18))

  assert.deepEqual(parseSave(saveToText(save)), save)
})

test('a damaged challenge is dropped without losing the rest of the save', () => {
  const save = startChallenge()
  const damaged = JSON.parse(saveToText(save))
  damaged.challenges.push({ id: 'broken', name: 'No tiers or dates' })
  damaged.realmXp.health = 75

  const reloaded = parseSave(JSON.stringify(damaged))
  assert.equal(reloaded?.challenges.length, 1)
  assert.equal(reloaded?.challenges[0].name, 'Movement')
  assert.equal(reloaded?.realmXp.health, 75)
})
