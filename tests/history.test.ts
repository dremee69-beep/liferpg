// TESTS for history: days, weeks, challenge week results and finished tiers.
// Run them with:  npm test
//
// The calendar used here: Monday 9 November 2026 starts a week.
//   Mon 9 ... Sun 15,  Mon 16 ... Sun 22,  Mon 23 ... Sun 29

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completeDaily, logAction } from '../src/game/actions.ts'
import { addChallenge, removeChallenge, settleChallenges } from '../src/game/challenges.ts'
import { daysHistory, describeEntry, weeksHistory } from '../src/game/history.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'
import type { SaveData } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

const WORKOUT = 'daily-health-1'

// A fresh save with one Health challenge (3 days a week for 2 weeks, then a
// second tier), created on Monday 9 November.
function startChallenge(): SaveData {
  return addChallenge(
    newSave('rachit'),
    {
      realm: 'health',
      name: 'Movement',
      dailyId: WORKOUT,
      tiers: [
        { name: 'Getting Moving', daysPerWeek: 3, weeks: 2 },
        { name: 'Habit Forming', daysPerWeek: 4, weeks: 3 },
      ],
    },
    nov(9),
  )
}

function workOutOn(save: SaveData, ...days: number[]): SaveData {
  for (const day of days) save = completeDaily(save, WORKOUT, nov(day))
  return save
}

function settle(save: SaveData, now: Date): SaveData {
  return settleChallenges(save, now).save
}

// ----- days ----------------------------------------------------------------

test('history groups the log by day, newest day first', () => {
  let save = newSave('rachit')
  save = logAction(save, 'mind', 25, nov(9, 8))
  save = completeDaily(save, WORKOUT, nov(9, 18))
  save = logAction(save, 'wealth', 10, nov(11))

  const days = daysHistory(save)
  assert.deepEqual(
    days.map((d) => d.day),
    ['2026-11-11', '2026-11-09'],
  )
  assert.equal(days[1].xp, 35)
  assert.equal(days[1].actions, 2)
  // Inside a day, the newest entry comes first.
  assert.equal(describeEntry(days[1].entries[0], save), 'Did a workout today')
  assert.equal(describeEntry(days[1].entries[1], save), 'Logged action')
})

test('an empty save has no history', () => {
  assert.deepEqual(daysHistory(newSave('deepika')), [])
  assert.deepEqual(weeksHistory(newSave('deepika')), [])
})

// ----- weeks ---------------------------------------------------------------

test('history adds up each week: XP, actions and dailies', () => {
  let save = newSave('rachit')
  save = logAction(save, 'mind', 25, nov(9))
  save = completeDaily(save, WORKOUT, nov(15, 22)) // Sunday night, same week
  save = completeDaily(save, WORKOUT, nov(16)) // Monday: a new week

  const weeks = weeksHistory(save)
  assert.deepEqual(
    weeks.map((w) => w.week),
    ['2026-11-16', '2026-11-09'],
  )
  assert.equal(weeks[1].xp, 35)
  assert.equal(weeks[1].actions, 2)
  assert.equal(weeks[1].dailies, 1)
  assert.equal(weeks[0].xp, 10)
})

// ----- challenge week results ----------------------------------------------

test('a week on target is written down', () => {
  const save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  assert.deepEqual(save.weekResults, [
    {
      challengeId: save.challenges[0].id,
      challengeName: 'Movement',
      tierName: 'Getting Moving',
      realm: 'health',
      week: '2026-11-09',
      outcome: 'onTarget',
    },
  ])
})

test('shielded, missed and free weeks are written down too', () => {
  // Week 1 (the challenge's first): nothing done, a free pass.
  let save = { ...startChallenge(), shields: 1 }
  // Weeks 2 and 3: nothing done. One shield, so one is covered, one missed.
  save = settle(save, nov(30))

  assert.deepEqual(
    save.weekResults.map((r) => [r.week, r.outcome]),
    [
      ['2026-11-09', 'free'],
      ['2026-11-16', 'shielded'],
      ['2026-11-23', 'missed'],
    ],
  )
})

test('week results show up in the weekly history, even with nothing logged', () => {
  const save = settle({ ...startChallenge(), shields: 0 }, nov(23))
  const weeks = weeksHistory(save)
  assert.equal(weeks[0].week, '2026-11-16')
  assert.equal(weeks[0].actions, 0)
  assert.equal(weeks[0].results[0].outcome, 'missed')
})

// ----- finished tiers ------------------------------------------------------

test('a finished tier is written down with its names and the time', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18))

  assert.deepEqual(save.finishedTiers, [
    {
      challengeId: save.challenges[0].id,
      challengeName: 'Movement',
      tierName: 'Getting Moving',
      realm: 'health',
      at: nov(18).toISOString(),
    },
  ])
})

test('history is kept when the challenge is removed', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18))
  save = removeChallenge(save, save.challenges[0].id)

  assert.equal(save.finishedTiers[0].challengeName, 'Movement')
  assert.equal(save.weekResults.length, 2)
})

// ----- saving --------------------------------------------------------------

test('history survives export and import', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18))
  assert.deepEqual(parseSave(saveToText(save)), save)
})

test('a version 5 save is upgraded, and its finished tiers are rebuilt from the log', () => {
  let save = settle(workOutOn(startChallenge(), 9, 10, 11), nov(11))
  save = settle(workOutOn(save, 16, 17, 18), nov(18)) // tier 1 finished

  const old = JSON.parse(saveToText(save))
  old.version = 5
  delete old.weekResults
  delete old.finishedTiers

  const upgraded = parseSave(JSON.stringify(old))
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.deepEqual(upgraded?.finishedTiers, save.finishedTiers)
  assert.deepEqual(upgraded?.weekResults, []) // these were not recorded before
  assert.equal(upgraded?.log.length, save.log.length)
})
