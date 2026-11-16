// TESTS for shields: earning them, spending them, and running out.
// Run them with:  npm test
//
// The calendar used here: Monday 9 November 2026 starts a week.
//   Mon 9 ... Sun 15,  Mon 16 ... Sun 22,  Mon 23 ... Sun 29,  Mon 30 ...

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  completeDaily,
  removeLogEntry,
  undoLastAction,
} from '../src/game/actions.ts'
import {
  activeDaysInWeek,
  addChallenge,
  settleChallenges,
} from '../src/game/challenges.ts'
import { weekKey } from '../src/game/dates.ts'
import { MAX_SHIELDS, SHIELDS_AT_START } from '../src/game/rules.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'
import type { ChallengeTier, SaveData } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

const WORKOUT = 'daily-health-1'
const READING = 'daily-mind-1'
const threeDaysFourWeeks: ChallengeTier[] = [
  { name: 'Getting Moving', daysPerWeek: 3, weeks: 4 },
]

// A fresh save with one Health challenge, created on Monday 9 November.
function startChallenge(tiers = threeDaysFourWeeks): SaveData {
  return addChallenge(
    newSave('rachit'),
    { realm: 'health', name: 'Movement', dailyId: WORKOUT, tiers },
    nov(9),
  )
}

// Tick a daily on each of the given days.
function tickOn(save: SaveData, dailyId: string, ...days: number[]): SaveData {
  for (const day of days) save = completeDaily(save, dailyId, nov(day))
  return save
}

function settle(save: SaveData, now: Date): SaveData {
  return settleChallenges(save, now).save
}

// ----- the numbers ---------------------------------------------------------

test('a new player starts with 1 shield and can hold 2', () => {
  assert.equal(SHIELDS_AT_START, 1)
  assert.equal(MAX_SHIELDS, 2)
  assert.equal(newSave('deepika').shields, 1)
})

// ----- earning -------------------------------------------------------------

test('a week finished on target earns a shield', () => {
  let save = tickOn(startChallenge(), WORKOUT, 9, 10, 11)
  save = settle(save, nov(11))
  assert.equal(save.shields, 2)
})

test('a player never holds more than 2 shields', () => {
  let save = settle(tickOn(startChallenge(), WORKOUT, 9, 10, 11), nov(11))
  save = settle(tickOn(save, WORKOUT, 16, 17, 18), nov(18))
  save = settle(tickOn(save, WORKOUT, 23, 24, 25), nov(25))
  assert.equal(save.shields, 2)
})

test('a week still running earns nothing until its target is reached', () => {
  const save = settle(tickOn(startChallenge(), WORKOUT, 9, 10), nov(10))
  assert.equal(save.shields, 1)
})

// ----- spending ------------------------------------------------------------

test('a missed week uses a shield, and the week counts as done', () => {
  let save = settle(tickOn(startChallenge(), WORKOUT, 9, 10, 11), nov(11)) // 2 shields
  save = tickOn(save, WORKOUT, 16) // week 2: only 1 day

  const result = settleChallenges(save, nov(23)) // the Monday after
  assert.equal(result.save.shields, 1)
  assert.equal(result.save.challenges[0].weeksDone, 2) // the challenge carries on

  // The screen is told, so it can show a card.
  assert.deepEqual(result.shieldsUsed, [
    {
      challengeId: save.challenges[0].id,
      challengeName: 'Movement',
      realm: 'health',
      week: '2026-11-16',
    },
  ])
})

test('a used shield leaves a note in the log, worth no XP', () => {
  let save = settle(tickOn(startChallenge(), WORKOUT, 9, 10, 11), nov(11))
  const xpBefore = save.realmXp.health
  save = settle(save, nov(23))

  const note = save.log[save.log.length - 1]
  assert.equal(note.shield, true)
  assert.equal(note.xp, 0)
  assert.equal(note.challengeId, save.challenges[0].id)
  assert.equal(save.realmXp.health, xpBefore)

  // The note is not something the player did: it never counts as an active
  // day, and it cannot be undone or removed.
  assert.equal(activeDaysInWeek(save, save.challenges[0], weekKey(nov(23))), 0)
  assert.equal(removeLogEntry(save, save.log.length - 1), save)
  assert.equal(undoLastAction(save).log.includes(note), true)
})

test('a shielded week earns no new shield', () => {
  let save = settle(tickOn(startChallenge(), WORKOUT, 9, 10, 11), nov(11))
  save = { ...save, shields: 1 }
  save = settle(save, nov(23)) // week 2 missed
  assert.equal(save.shields, 0)
})

test('a shield can finish a tier, and the reward is paid', () => {
  const twoWeeks = [{ name: 'Getting Moving', daysPerWeek: 3, weeks: 2 }]
  let save = settle(tickOn(startChallenge(twoWeeks), WORKOUT, 9, 10, 11), nov(11))

  const result = settleChallenges(save, nov(23)) // week 2 missed, shield used
  save = result.save
  assert.equal(result.shieldsUsed.length, 1)
  assert.equal(result.completed.length, 1)
  assert.equal(save.challenges[0].tierIndex, 1)
  assert.equal(save.skillPoints.health, 1)
})

// ----- running out ---------------------------------------------------------

test('with no shield left, the missed week just has to be done again', () => {
  let save = settle(tickOn(startChallenge(), WORKOUT, 9, 10, 11), nov(11))
  save = { ...save, shields: 0 }

  const result = settleChallenges(save, nov(23)) // week 2 missed
  save = result.save
  assert.deepEqual(result.shieldsUsed, [])
  assert.equal(save.shields, 0)
  assert.equal(save.challenges[0].weeksDone, 1) // week 1 is kept
  assert.equal(save.challenges[0].tierIndex, 0) // the tier never drops back
})

test('one shield covers one missed week; the next missed week repeats', () => {
  let save = settle(tickOn(startChallenge(), WORKOUT, 9, 10, 11), nov(11))
  save = { ...save, shields: 1 }

  save = settle(save, nov(30)) // weeks 2 and 3 both missed
  assert.equal(save.shields, 0)
  assert.equal(save.challenges[0].weeksDone, 2) // week 1 + the shielded week
})

// ----- free passes ---------------------------------------------------------

test('a missed part-week at the start of a challenge costs no shield', () => {
  // Created on Friday 13th: only three days of the week are left.
  let save = addChallenge(
    newSave('deepika'),
    { realm: 'health', name: 'Movement', dailyId: WORKOUT, tiers: threeDaysFourWeeks },
    nov(13),
  )
  save = settle(save, nov(16))
  assert.equal(save.shields, 1)
  assert.equal(save.challenges[0].weeksDone, 0)
})

test('weeks missed before shields existed are not charged', () => {
  let save = startChallenge() // created Monday 9th
  // As if the app was updated in the week of Monday 23rd.
  save = { ...save, shieldsFrom: '2026-11-23' }

  save = settle(save, nov(23)) // the week of the 16th was missed
  assert.equal(save.shields, 1) // not charged
  assert.equal(save.challenges[0].weeksDone, 0)

  save = settle(save, nov(30)) // the week of the 23rd was missed too
  assert.equal(save.shields, 0) // this one is charged
  assert.equal(save.challenges[0].weeksDone, 1)
})

// ----- more than one challenge ---------------------------------------------

// A save with two challenges, both created on Monday 9 November:
// Reading (Mind) first in the list, then Movement (Health).
function twoChallenges(): SaveData {
  const save = addChallenge(
    newSave('rachit'),
    { realm: 'mind', name: 'Reading', dailyId: READING, tiers: threeDaysFourWeeks },
    nov(9),
  )
  return addChallenge(
    save,
    { realm: 'health', name: 'Movement', dailyId: WORKOUT, tiers: threeDaysFourWeeks },
    nov(9, 10),
  )
}

test('when two challenges miss a week with one shield, the first in the list gets it', () => {
  let save = twoChallenges()
  // Week 1: both on target (which fills the shields to 2).
  save = tickOn(save, READING, 9, 10, 11)
  save = tickOn(save, WORKOUT, 9, 10, 11)
  save = settle(save, nov(11))
  save = { ...save, shields: 1 }

  const result = settleChallenges(save, nov(23)) // week 2: both missed
  assert.equal(result.save.shields, 0)
  assert.deepEqual(
    result.shieldsUsed.map((use) => use.challengeName),
    ['Reading'],
  )
  assert.equal(result.save.challenges[0].weeksDone, 2) // Reading: covered
  assert.equal(result.save.challenges[1].weeksDone, 1) // Movement: repeats
})

test('in one week, a shield earned by one challenge can cover the other', () => {
  let save = twoChallenges()
  save = tickOn(save, READING, 9, 10, 11)
  save = tickOn(save, WORKOUT, 9, 10, 11)
  save = settle(save, nov(11))
  save = { ...save, shields: 0 }

  // Week 2: Reading (first in the list) is missed, Movement is on target.
  save = tickOn(save, WORKOUT, 16, 17, 18)
  save = settle(save, nov(23))

  assert.equal(save.challenges[1].weeksDone, 2) // Movement: on target
  assert.equal(save.challenges[0].weeksDone, 2) // Reading: covered by the new shield
  assert.equal(save.shields, 0)
})

test('a shield earned in one week can cover a miss in a later week', () => {
  let save = twoChallenges()
  save = { ...save, shields: 0 }
  // Week 1: only Movement is on target. Reading's first week is a free pass.
  save = tickOn(save, WORKOUT, 9, 10, 11)
  // Weeks 2 and 3: nothing at all. Looked at only on Monday 30th.
  save = settle(save, nov(30))

  // Movement's week 1 earned one shield; Reading (first in the list) used
  // it for week 2. Everything else simply did not count.
  assert.equal(save.shields, 0)
  assert.equal(save.challenges[0].weeksDone, 1)
  assert.equal(save.challenges[1].weeksDone, 1)
})

// ----- saving --------------------------------------------------------------

test('a version 4 save is upgraded with 1 shield and no back-charging', () => {
  const oldSave = JSON.parse(saveToText(startChallenge()))
  oldSave.version = 4
  delete oldSave.shields
  delete oldSave.shieldsFrom
  oldSave.realmXp.health = 210

  const upgraded = parseSave(JSON.stringify(oldSave))
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.equal(upgraded?.shields, 1)
  assert.equal(upgraded?.shieldsFrom, weekKey(new Date())) // from this week on
  assert.equal(upgraded?.realmXp.health, 210)
  assert.equal(upgraded?.challenges.length, 1)
})

test('shields and shield notes survive export and import', () => {
  let save = settle(tickOn(startChallenge(), WORKOUT, 9, 10, 11), nov(11))
  save = settle(save, nov(23)) // a shield is used
  assert.deepEqual(parseSave(saveToText(save)), save)
})

test('a save claiming too many shields is trimmed to the most allowed', () => {
  const tampered = JSON.parse(saveToText(newSave('rachit')))
  tampered.shields = 99
  assert.equal(parseSave(JSON.stringify(tampered))?.shields, MAX_SHIELDS)
})
