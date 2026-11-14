// TESTS for saving and loading.
// Run them with:  npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  exportFileName,
  loadSave,
  newSave,
  parseSave,
  saveToText,
  writeSave,
} from '../src/storage/save.ts'

test('an exported save imports back exactly the same', () => {
  const save = newSave('deepika')
  save.realmXp.wealth = 310
  save.log.push({ realm: 'wealth', xp: 10, at: '2026-11-14T08:30:00.000Z' })

  assert.deepEqual(parseSave(saveToText(save)), save)
})

test('the backup file is named after the player and the date', () => {
  // Month 10 means November: JavaScript counts months from 0.
  const date = new Date(2026, 10, 4)
  assert.equal(
    exportFileName(newSave('rachit'), date),
    'liferpg-rachit-2026-11-04.txt',
  )
})

// A pretend browser storage, so these tests run without a browser.
function fakeStore() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
  }
}

test('first launch: there is no save yet', () => {
  assert.equal(loadSave(fakeStore()), null)
})

test('what you write is what you load back', () => {
  const store = fakeStore()
  const save = newSave('rachit')
  save.realmXp.health = 125
  save.log.push({ realm: 'health', xp: 25, at: '2026-11-14T10:00:00.000Z' })

  assert.equal(writeSave(save, store), true)
  assert.deepEqual(loadSave(store), save)
})

test('a damaged save is not loaded, and its text is kept as a backup', () => {
  const store = fakeStore()
  store.setItem('liferpg-save', 'this is not a save {{{')

  assert.equal(loadSave(store), null)
  assert.equal(
    store.items.get('liferpg-save-unreadable-backup'),
    'this is not a save {{{',
  )
})

test('a save from a newer app version is refused, not guessed at', () => {
  const fromTheFuture = { ...newSave('deepika'), version: 999 }
  assert.equal(parseSave(JSON.stringify(fromTheFuture)), null)
})

test('nonsense values are refused', () => {
  const negativeXp = newSave('rachit')
  negativeXp.realmXp.mind = -50
  assert.equal(parseSave(JSON.stringify(negativeXp)), null)

  const unknownPlayer = { ...newSave('rachit'), player: 'someone-else' }
  assert.equal(parseSave(JSON.stringify(unknownPlayer)), null)
})

test('a realm missing from the save starts at 0 XP', () => {
  const text = JSON.stringify({
    version: 1,
    player: 'deepika',
    realmXp: { health: 40 },
    log: [],
  })
  const save = parseSave(text)
  assert.equal(save?.realmXp.health, 40)
  assert.equal(save?.realmXp.wealth, 0)
})
