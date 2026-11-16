// TESTS for share codes and the partner view.
// Run them with:  npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { logAction } from '../src/game/actions.ts'
import { addEpic } from '../src/game/epics.ts'
import {
  applyPartnerCode,
  daysSince,
  makeShareCode,
  readShareCode,
} from '../src/game/share.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

// Deepika's save with some progress, and the code made from it.
function deepikaCode(day = 16): string {
  let save = newSave('deepika')
  save = logAction(save, 'mind', 250, nov(10))
  save = logAction(save, 'health', 40, nov(11))
  save = { ...save, shields: 2 }
  return makeShareCode(save, nov(day))
}

// ----- making and reading --------------------------------------------------

test('a share code is one block of chat-safe letters', () => {
  const code = deepikaCode()
  assert.match(code, /^LRPG1\.[A-Za-z0-9_-]+$/)
})

test('reading a code gives back the summary it was made from', () => {
  assert.deepEqual(readShareCode(deepikaCode())?.summary, {
    player: 'deepika',
    realmXp: { health: 40, mind: 250, wealth: 0, together: 0, questAbroad: 0 },
    shields: 2,
    at: nov(16).toISOString(),
  })
})

test('a code holds only the summary, nothing personal', () => {
  let save = newSave('deepika')
  save = addEpic(
    save,
    { realm: 'mind', name: 'Learn the guitar', milestones: ['Buy a guitar'] },
    nov(9),
  )
  const code = readShareCode(makeShareCode(save, nov(16)))
  assert.deepEqual(Object.keys(code?.summary ?? {}).sort(), ['at', 'player', 'realmXp', 'shields'])
  assert.deepEqual(code?.party, []) // nothing logged, so no party quests sent
})

test('a code is found inside a longer chat message', () => {
  const message = `Here is my code for today!\n${deepikaCode()}\nSend me yours :)`
  assert.equal(readShareCode(message)?.summary.player, 'deepika')
})

test('text without a code, or with a damaged one, is refused', () => {
  assert.equal(readShareCode(''), null)
  assert.equal(readShareCode('hello there'), null)
  assert.equal(readShareCode('LRPG1.not-a-real-code'), null)
  assert.equal(readShareCode(deepikaCode().slice(0, 30)), null) // cut short
})

// ----- using a partner's code ----------------------------------------------

test("pasting a partner's code remembers their summary", () => {
  const mine = newSave('rachit')
  assert.equal(mine.partner, null)

  const result = applyPartnerCode(mine, deepikaCode(), nov(20))
  assert.equal(result.problem, null)
  assert.equal(result.save.partner?.player, 'deepika')
  assert.equal(result.save.partner?.realmXp.mind, 250)
  // Nothing of mine changed.
  assert.deepEqual(result.save.realmXp, mine.realmXp)
})

test('your own code is refused', () => {
  const mine = newSave('deepika')
  const result = applyPartnerCode(mine, deepikaCode(), nov(20))
  assert.equal(result.problem, 'own')
  assert.equal(result.save, mine) // the very same save
})

test('an unreadable code changes nothing', () => {
  const mine = newSave('rachit')
  const result = applyPartnerCode(mine, 'LRPG1.oops', nov(20))
  assert.equal(result.problem, 'unreadable')
  assert.equal(result.save, mine)
})

test('a newer code replaces an older one, but not the other way round', () => {
  let mine = applyPartnerCode(newSave('rachit'), deepikaCode(16), nov(20)).save

  const older = applyPartnerCode(mine, deepikaCode(14), nov(20))
  assert.equal(older.problem, 'older')
  assert.equal(older.save, mine)

  mine = applyPartnerCode(mine, deepikaCode(18), nov(20)).save
  assert.equal(mine.partner?.at, nov(18).toISOString())
})

// ----- how fresh -----------------------------------------------------------

test('the age of a code is counted in calendar days', () => {
  const at = nov(16, 23).toISOString() // late on the 16th
  assert.equal(daysSince(at, nov(16, 23)), 0)
  assert.equal(daysSince(at, nov(17, 1)), 1) // two hours later, but "yesterday"
  assert.equal(daysSince(at, nov(19)), 3)
  assert.equal(daysSince(at, nov(15)), 0) // a clock set wrong never gives a minus
})

// ----- saving --------------------------------------------------------------

test('the partner summary survives export and import', () => {
  const save = applyPartnerCode(newSave('rachit'), deepikaCode(), nov(20)).save
  assert.deepEqual(parseSave(saveToText(save)), save)
})

test('a version 7 save is upgraded with no partner yet', () => {
  const old = JSON.parse(saveToText(logAction(newSave('rachit'), 'mind', 25, nov(9))))
  old.version = 7
  delete old.partner

  const upgraded = parseSave(JSON.stringify(old))
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.equal(upgraded?.partner, null)
  assert.equal(upgraded?.realmXp.mind, 25)
})

test('a damaged partner summary is dropped without losing the save', () => {
  const save = applyPartnerCode(newSave('rachit'), deepikaCode(), nov(20)).save
  const damaged = JSON.parse(saveToText(logAction(save, 'mind', 25, nov(9))))
  damaged.partner.realmXp = 'nonsense'

  const reloaded = parseSave(JSON.stringify(damaged))
  assert.equal(reloaded?.partner, null)
  assert.equal(reloaded?.realmXp.mind, 25)
})
