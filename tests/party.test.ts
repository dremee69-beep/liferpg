// TESTS for party quests: logging, confirming through share codes, and XP.
// Run them with:  npm test
//
// These tests play both phones: `rachit` and `deepika` are two separate
// saves, and share codes are passed between them just like on WhatsApp.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { logAction, removeLogEntry, undoLastAction } from '../src/game/actions.ts'
import { describeEntry } from '../src/game/history.ts'
import {
  addPartyQuest,
  cancelPartyLog,
  canAddPartyQuest,
  confirmPartyLog,
  declinePartyLog,
  logPartyQuest,
  removePartyQuest,
} from '../src/game/party.ts'
import {
  MAX_PARTY_QUESTS,
  PARTY_LOGS_IN_CODE,
  PARTY_QUEST_XP,
} from '../src/game/rules.ts'
import { applyPartnerCode, makeShareCode, readShareCode } from '../src/game/share.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'
import type { SaveData } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

const DATE_NIGHT = 'party-1'

// Send a share code from one phone to the other: make it on `from`, read
// it on `to`. Hands back the receiving phone's new save and the news.
function send(from: SaveData, to: SaveData, when: Date) {
  const result = applyPartnerCode(to, makeShareCode(from, when), when)
  assert.equal(result.problem, null)
  return result
}

// ----- the numbers and the list --------------------------------------------

test('a party quest is worth 25 XP, and a new save has the four starters', () => {
  assert.equal(PARTY_QUEST_XP, 25)
  assert.deepEqual(
    newSave('rachit').partyQuests.map((q) => q.name),
    ['Date night', 'Cooking together', 'A walk together', 'Weekly campfire review'],
  )
})

test('party quests can be added and removed, up to a limit', () => {
  let save = addPartyQuest(newSave('rachit'), '  Board game night  ', nov(9))
  assert.equal(save.partyQuests[4].name, 'Board game night')
  assert.equal(addPartyQuest(save, '   ', nov(9)), save) // nothing typed

  save = removePartyQuest(save, DATE_NIGHT)
  assert.equal(save.partyQuests.some((q) => q.id === DATE_NIGHT), false)

  for (let i = 0; i < MAX_PARTY_QUESTS; i++) {
    save = addPartyQuest(save, `Quest ${i}`, nov(10, i))
  }
  assert.equal(save.partyQuests.length, MAX_PARTY_QUESTS)
  assert.equal(canAddPartyQuest(save), false)
})

// ----- logging -------------------------------------------------------------

test('logging a party quest waits for the partner and pays nothing yet', () => {
  const save = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))

  assert.equal(save.partyLogs.length, 1)
  assert.equal(save.partyLogs[0].name, 'Date night')
  assert.equal(save.partyLogs[0].by, 'rachit')
  assert.equal(save.partyLogs[0].state, 'pending')
  assert.equal(save.realmXp.together, 0)
  assert.equal(save.log.length, 0)
})

test('you cannot confirm or decline your own party quest', () => {
  const save = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  const id = save.partyLogs[0].id
  assert.equal(confirmPartyLog(save, id, nov(12)), save)
  assert.equal(declinePartyLog(save, id), save)
})

test('a party quest you logged can be cancelled while it waits', () => {
  let save = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  save = cancelPartyLog(save, save.partyLogs[0].id)
  assert.equal(save.partyLogs.length, 0)
})

// ----- the full round trip -------------------------------------------------

test('the whole journey: log, send, confirm, send back, both are paid', () => {
  let rachit = newSave('rachit')
  let deepika = newSave('deepika')

  // 1. Rachit logs a date night.
  rachit = logPartyQuest(rachit, DATE_NIGHT, nov(12))

  // 2. His share code reaches Deepika: she has one to confirm.
  const arrived = send(rachit, deepika, nov(12, 20))
  deepika = arrived.save
  assert.deepEqual(
    arrived.news.toConfirm.map((log) => log.name),
    ['Date night'],
  )
  assert.equal(deepika.partyLogs[0].state, 'pending')
  assert.equal(deepika.realmXp.together, 0) // nothing paid yet

  // 3. Deepika confirms: her phone pays her.
  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13))
  assert.equal(deepika.realmXp.together, 25)
  assert.equal(deepika.partyLogs[0].state, 'confirmed')
  assert.equal(describeEntry(deepika.log[0], deepika), 'Party quest: Date night')

  // 4. Her share code reaches Rachit: his phone pays him the same.
  const back = send(deepika, rachit, nov(13, 20))
  rachit = back.save
  assert.deepEqual(
    back.news.confirmed.map((log) => log.name),
    ['Date night'],
  )
  assert.equal(rachit.realmXp.together, 25)
  assert.equal(rachit.partyLogs[0].state, 'confirmed')
  assert.equal(rachit.partner?.realmXp.together, 25) // her card shows it too
})

test('reading the same code twice never pays twice', () => {
  let rachit = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  let deepika = send(rachit, newSave('deepika'), nov(12, 20)).save
  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13))

  const code = makeShareCode(deepika, nov(13, 20))
  rachit = applyPartnerCode(rachit, code, nov(13, 21)).save
  const again = applyPartnerCode(rachit, code, nov(13, 22))

  assert.equal(again.save.realmXp.together, 25)
  assert.deepEqual(again.news.confirmed, [])
})

test('a later code from the logger does not ask for confirmation again', () => {
  const rachit = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  let deepika = send(rachit, newSave('deepika'), nov(12, 20)).save
  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13))

  // Rachit has not read her code yet, so his next code still says "pending".
  const second = send(rachit, deepika, nov(14))
  assert.deepEqual(second.news.toConfirm, [])
  assert.equal(second.save.partyLogs.length, 1)
  assert.equal(second.save.partyLogs[0].state, 'confirmed')
  assert.equal(second.save.realmXp.together, 25)
})

// ----- declining -----------------------------------------------------------

test('a declined party quest pays nobody, and the logger is told', () => {
  let rachit = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  let deepika = send(rachit, newSave('deepika'), nov(12, 20)).save
  deepika = declinePartyLog(deepika, deepika.partyLogs[0].id)
  assert.equal(deepika.realmXp.together, 0)

  const back = send(deepika, rachit, nov(13))
  rachit = back.save
  assert.deepEqual(
    back.news.declined.map((log) => log.name),
    ['Date night'],
  )
  assert.equal(rachit.partyLogs[0].state, 'declined')
  assert.equal(rachit.realmXp.together, 0)

  // He can clear it away. If his old code turns up again on her phone, it
  // does not come back as something to confirm.
  const again = send(rachit, deepika, nov(14))
  assert.deepEqual(again.news.toConfirm, [])
  rachit = cancelPartyLog(rachit, rachit.partyLogs[0].id)
  assert.equal(rachit.partyLogs.length, 0)
})

test('if the logger cancels but the partner had already confirmed, it counts', () => {
  let rachit = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  let deepika = send(rachit, newSave('deepika'), nov(12, 20)).save
  rachit = cancelPartyLog(rachit, rachit.partyLogs[0].id) // changed his mind
  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13)) // too late

  rachit = send(deepika, rachit, nov(14)).save
  assert.equal(rachit.realmXp.together, 25) // both are paid: the totals match
  assert.equal(rachit.partyLogs[0].state, 'confirmed')
})

// ----- the XP is protected -------------------------------------------------

test('party quest XP cannot be removed or undone by hand', () => {
  const rachit = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  let deepika = logAction(newSave('deepika'), 'mind', 10, nov(11))
  deepika = send(rachit, deepika, nov(12, 20)).save
  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13))

  assert.equal(removeLogEntry(deepika, deepika.log.length - 1), deepika)

  // Undo skips the party quest and takes back her own last action instead.
  const undone = undoLastAction(deepika)
  assert.equal(undone.realmXp.together, 25)
  assert.equal(undone.realmXp.mind, 0)
})

// ----- share codes ---------------------------------------------------------

test('a share code carries only the newest party quests', () => {
  let save = newSave('rachit')
  for (let i = 0; i < PARTY_LOGS_IN_CODE + 5; i++) {
    save = logPartyQuest(save, DATE_NIGHT, new Date(2026, 10, 1, 0, i))
  }
  const code = readShareCode(makeShareCode(save, nov(20)))
  assert.equal(code?.party.length, PARTY_LOGS_IN_CODE)
  // The last one in the code is the last one logged.
  assert.equal(code?.party.at(-1)?.id, save.partyLogs.at(-1)?.id)
})

test('party quest names with accents or emoji survive the trip', () => {
  let rachit = addPartyQuest(newSave('rachit'), 'Café date ☕', nov(9))
  rachit = logPartyQuest(rachit, rachit.partyQuests.at(-1)!.id, nov(12))
  const deepika = send(rachit, newSave('deepika'), nov(12, 20)).save
  assert.equal(deepika.partyLogs[0].name, 'Café date ☕')
})

// ----- saving --------------------------------------------------------------

test('party quests and their logs survive export and import', () => {
  const rachit = logPartyQuest(newSave('rachit'), DATE_NIGHT, nov(12))
  let deepika = send(rachit, newSave('deepika'), nov(12, 20)).save
  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13))
  assert.deepEqual(parseSave(saveToText(deepika)), deepika)
})

test('a version 8 save is upgraded with the starting party quests', () => {
  const old = JSON.parse(saveToText(logAction(newSave('rachit'), 'mind', 25, nov(9))))
  old.version = 8
  delete old.partyQuests
  delete old.partyLogs

  const upgraded = parseSave(JSON.stringify(old))
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.equal(upgraded?.partyQuests.length, 4)
  assert.deepEqual(upgraded?.partyLogs, [])
  assert.equal(upgraded?.realmXp.mind, 25)
})
