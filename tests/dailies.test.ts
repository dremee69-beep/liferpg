// TESTS for daily quests and for upgrading old saves.
// Run them with:  npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  completeDaily,
  isDailyDoneToday,
  undoLastAction,
} from '../src/game/actions.ts'
import { dayKey } from '../src/game/dates.ts'
import { addDaily, setDailyXp } from '../src/game/dailies.ts'
import { DEFAULT_DAILIES } from '../src/game/rules.ts'
import { newSave, parseSave, SAVE_VERSION } from '../src/storage/save.ts'

// Dates written without a "Z" are in the computer's local time, which is
// what the game uses for "today".
const morning = new Date(2026, 10, 14, 8, 0) // 14 Nov 2026, 08:00
const evening = new Date(2026, 10, 14, 23, 30) // same day, 23:30
const nextDay = new Date(2026, 10, 15, 0, 5) // 15 Nov 2026, 00:05

test('the same local day gives the same day key', () => {
  assert.equal(dayKey(morning), '2026-11-14')
  assert.equal(dayKey(evening), '2026-11-14')
  assert.equal(dayKey(nextDay), '2026-11-15')
})

test('a new save starts with one daily per realm', () => {
  const save = newSave('rachit')
  assert.equal(save.dailies.length, 5)
  assert.deepEqual(
    save.dailies.map((d) => d.realm),
    ['health', 'mind', 'wealth', 'together', 'questAbroad'],
  )
})

test('ticking a daily gives 10 XP in its realm and marks it done today', () => {
  const before = newSave('rachit')
  assert.equal(isDailyDoneToday(before, 'daily-health-1', morning), false)

  const after = completeDaily(before, 'daily-health-1', morning)
  assert.equal(after.realmXp.health, 10)
  assert.equal(after.realmXp.mind, 0)
  assert.equal(isDailyDoneToday(after, 'daily-health-1', evening), true)
})

test('a daily can only be ticked once per day', () => {
  let save = newSave('rachit')
  save = completeDaily(save, 'daily-mind-1', morning)
  save = completeDaily(save, 'daily-mind-1', evening)

  assert.equal(save.realmXp.mind, 10)
  assert.equal(save.log.length, 1)
})

test('a daily opens up again after midnight', () => {
  let save = newSave('deepika')
  save = completeDaily(save, 'daily-mind-1', evening)
  assert.equal(isDailyDoneToday(save, 'daily-mind-1', nextDay), false)

  save = completeDaily(save, 'daily-mind-1', nextDay)
  assert.equal(save.realmXp.mind, 20)
})

test('undo re-opens a daily ticked by mistake', () => {
  let save = newSave('deepika')
  save = completeDaily(save, 'daily-wealth-1', morning)
  save = undoLastAction(save)

  assert.equal(save.realmXp.wealth, 0)
  assert.equal(isDailyDoneToday(save, 'daily-wealth-1', morning), false)
})

test('ticking a daily that does not exist changes nothing', () => {
  const save = newSave('rachit')
  assert.equal(completeDaily(save, 'no-such-daily', morning), save)
})

test('a version 1 save is upgraded without losing anything', () => {
  // This is exactly the shape of the saves made before dailies existed.
  const oldSave = JSON.stringify({
    version: 1,
    player: 'rachit',
    realmXp: { health: 325, mind: 40, wealth: 0, together: 10, questAbroad: 75 },
    log: [{ realm: 'health', xp: 25, at: '2026-11-10T07:00:00.000Z' }],
  })

  const upgraded = parseSave(oldSave)
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.deepEqual(upgraded?.realmXp, {
    health: 325,
    mind: 40,
    wealth: 0,
    together: 10,
    questAbroad: 75,
  })
  assert.deepEqual(upgraded?.log, [
    { realm: 'health', xp: 25, at: '2026-11-10T07:00:00.000Z' },
  ])
  assert.deepEqual(upgraded?.dailies, DEFAULT_DAILIES)
})

test('a big daily gives 25 XP', () => {
  let save = addDaily(newSave('rachit'), 'health', 'Full workout', 25, morning)
  const big = save.dailies[save.dailies.length - 1]
  assert.equal(big.xp, 25)

  save = completeDaily(save, big.id, morning)
  assert.equal(save.realmXp.health, 25)
  assert.equal(save.log[0].xp, 25)
})

test('a daily can be switched between small and big', () => {
  let save = setDailyXp(newSave('deepika'), 'daily-mind-1', 25)
  assert.equal(save.dailies.find((d) => d.id === 'daily-mind-1')?.xp, 25)

  save = setDailyXp(save, 'daily-mind-1', 10)
  assert.equal(save.dailies.find((d) => d.id === 'daily-mind-1')?.xp, 10)
})

test('only 10 and 25 are allowed sizes', () => {
  const save = newSave('deepika')
  assert.equal(setDailyXp(save, 'daily-mind-1', 1000), save)
  assert.equal(addDaily(save, 'mind', 'Cheat', 500, morning), save)
})

test('changing a size does not rewrite XP already earned', () => {
  let save = completeDaily(newSave('rachit'), 'daily-health-1', morning)
  save = setDailyXp(save, 'daily-health-1', 25)

  // Today's tick was worth 10 when it was made, and stays 10.
  assert.equal(save.realmXp.health, 10)
  assert.equal(save.log[0].xp, 10)

  // Tomorrow's tick is worth the new size.
  save = completeDaily(save, 'daily-health-1', nextDay)
  assert.equal(save.realmXp.health, 35)
})

test('removing a big daily entry takes back its 25 XP', () => {
  let save = setDailyXp(newSave('rachit'), 'daily-health-1', 25)
  save = completeDaily(save, 'daily-health-1', morning)
  save = undoLastAction(save)
  assert.equal(save.realmXp.health, 0)
})

test('a version 2 save is upgraded: every daily becomes a small one', () => {
  // The shape of saves made before dailies had sizes, including a daily the
  // player renamed and one they added themselves.
  const oldSave = JSON.stringify({
    version: 2,
    player: 'deepika',
    realmXp: { health: 120, mind: 30, wealth: 0, together: 0, questAbroad: 0 },
    log: [
      {
        realm: 'health',
        xp: 10,
        at: '2026-11-14T07:00:00.000Z',
        dailyId: 'daily-health-1',
      },
    ],
    dailies: [
      { id: 'daily-health-1', realm: 'health', name: 'Moved my body' },
      { id: 'daily-mind-abc', realm: 'mind', name: 'Practice a language' },
    ],
  })

  const upgraded = parseSave(oldSave)
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.equal(upgraded?.realmXp.health, 120)
  assert.equal(upgraded?.log.length, 1)
  assert.deepEqual(upgraded?.dailies, [
    { id: 'daily-health-1', realm: 'health', name: 'Moved my body', xp: 10 },
    { id: 'daily-mind-abc', realm: 'mind', name: 'Practice a language', xp: 10 },
  ])
})

test('a daily with an unknown size is kept, as a small one', () => {
  const text = JSON.stringify({
    version: 3,
    player: 'rachit',
    realmXp: {},
    log: [],
    dailies: [{ id: 'd1', realm: 'mind', name: 'Odd one', xp: 999 }],
  })
  assert.deepEqual(parseSave(text)?.dailies, [
    { id: 'd1', realm: 'mind', name: 'Odd one', xp: 10 },
  ])
})

test('the daily a log entry belongs to survives export and import', () => {
  const save = completeDaily(newSave('deepika'), 'daily-health-1', morning)
  const reloaded = parseSave(JSON.stringify(save))
  assert.equal(reloaded?.log[0].dailyId, 'daily-health-1')
})
