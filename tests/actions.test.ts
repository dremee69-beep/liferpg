// TESTS for logging and undoing actions.
// Run them with:  npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { logAction, undoLastAction } from '../src/game/actions.ts'
import { newSave } from '../src/storage/save.ts'

const noon = new Date('2026-11-14T12:00:00.000Z')

test('logging adds XP to that realm only, and writes a log line', () => {
  const after = logAction(newSave('rachit'), 'mind', 10, noon)

  assert.equal(after.realmXp.mind, 10)
  assert.equal(after.realmXp.health, 0)
  assert.deepEqual(after.log, [
    { realm: 'mind', xp: 10, at: '2026-11-14T12:00:00.000Z' },
  ])
})

test('logging does not change the save it was given', () => {
  const before = newSave('rachit')
  logAction(before, 'health', 25, noon)

  assert.equal(before.realmXp.health, 0)
  assert.equal(before.log.length, 0)
})

test('undo takes back exactly the last action', () => {
  let save = newSave('deepika')
  save = logAction(save, 'health', 25, noon)
  save = logAction(save, 'wealth', 10, noon)
  save = undoLastAction(save)

  assert.equal(save.realmXp.wealth, 0)
  assert.equal(save.realmXp.health, 25)
  assert.equal(save.log.length, 1)
})

test('undo with nothing logged changes nothing', () => {
  const save = newSave('deepika')
  assert.deepEqual(undoLastAction(save), save)
})
