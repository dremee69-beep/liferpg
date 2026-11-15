// TESTS for adding, renaming and removing daily quests.
// Run them with:  npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completeDaily, isDailyDoneToday } from '../src/game/actions.ts'
import {
  addDaily,
  canAddDaily,
  canRemoveDaily,
  cleanDailyName,
  dailyStatuses,
  removeDaily,
  renameDaily,
} from '../src/game/dailies.ts'
import { newSave } from '../src/storage/save.ts'

const now = new Date(2026, 10, 15, 9, 0)
const aBitLater = new Date(2026, 10, 15, 9, 1)

test('names are tidied, and an empty name is refused', () => {
  assert.equal(cleanDailyName('  Stretch for 5 minutes  '), 'Stretch for 5 minutes')
  assert.equal(cleanDailyName('   '), null)
  assert.equal(cleanDailyName('a'.repeat(100))?.length, 60)
})

test('adding a daily puts it in the right realm with its own id', () => {
  const save = addDaily(newSave('rachit'), 'mind', 'Practice a language', 10, now)

  const mind = save.dailies.filter((d) => d.realm === 'mind')
  assert.equal(mind.length, 2)
  assert.equal(mind[1].name, 'Practice a language')
  assert.notEqual(mind[1].id, mind[0].id)
})

test('two dailies added at the same instant still get different ids', () => {
  let save = newSave('rachit')
  save = addDaily(save, 'mind', 'One', 10, now)
  save = addDaily(save, 'mind', 'Two', 10, now)

  const ids = save.dailies.map((d) => d.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('a realm holds at most 3 dailies', () => {
  let save = newSave('deepika')
  save = addDaily(save, 'health', 'Second', 10, now)
  save = addDaily(save, 'health', 'Third', 10, aBitLater)
  assert.equal(canAddDaily(save, 'health'), false)

  const full = save
  assert.equal(addDaily(full, 'health', 'Fourth', 10, now), full)
  // Other realms still have room.
  assert.equal(canAddDaily(save, 'mind'), true)
})

test('a daily with an empty name is not added', () => {
  const save = newSave('deepika')
  assert.equal(addDaily(save, 'wealth', '   ', 10, now), save)
})

test('renaming keeps the id, so "done today" survives the rename', () => {
  let save = completeDaily(newSave('rachit'), 'daily-health-1', now)
  save = renameDaily(save, 'daily-health-1', 'Moved my body')

  assert.equal(save.dailies[0].id, 'daily-health-1')
  assert.equal(save.dailies[0].name, 'Moved my body')
  assert.equal(isDailyDoneToday(save, 'daily-health-1', now), true)
})

test('renaming to an empty or unchanged name changes nothing', () => {
  const save = newSave('rachit')
  assert.equal(renameDaily(save, 'daily-health-1', '  '), save)
  assert.equal(renameDaily(save, 'daily-health-1', 'Did a workout today'), save)
  assert.equal(renameDaily(save, 'no-such-daily', 'Hello'), save)
})

test('the last daily in a realm cannot be removed', () => {
  const save = newSave('deepika')
  assert.equal(canRemoveDaily(save, 'daily-mind-1'), false)
  assert.equal(removeDaily(save, 'daily-mind-1'), save)
})

test('removing a daily keeps the XP it already earned', () => {
  let save = addDaily(newSave('deepika'), 'mind', 'Second', 10, now)
  save = completeDaily(save, 'daily-mind-1', now)
  assert.equal(canRemoveDaily(save, 'daily-mind-1'), true)

  save = removeDaily(save, 'daily-mind-1')
  assert.equal(save.dailies.some((d) => d.id === 'daily-mind-1'), false)
  assert.equal(save.realmXp.mind, 10)
  assert.equal(save.log.length, 1)
})

test('statuses list one realm and mark what is done today', () => {
  const save = completeDaily(newSave('rachit'), 'daily-wealth-1', now)

  assert.deepEqual(dailyStatuses(save, 'wealth', now), [
    { id: 'daily-wealth-1', name: "Logged today's spending", xp: 10, doneToday: true },
  ])
  assert.equal(dailyStatuses(save, 'health', now)[0].doneToday, false)
})
