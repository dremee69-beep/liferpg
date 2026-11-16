// TESTS for Together as the pair-only realm: its XP comes only from party
// quests both players agreed on.
// Run them with:  npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completeDaily, logAction } from '../src/game/actions.ts'
import { activeDaysInWeek, addChallenge } from '../src/game/challenges.ts'
import { addDaily, canAddDaily } from '../src/game/dailies.ts'
import { weekKey } from '../src/game/dates.ts'
import { confirmPartyLog, logPartyQuest } from '../src/game/party.ts'
import { isPairRealm, MAX_PARTY_QUESTS, SOLO_REALMS } from '../src/game/rules.ts'
import { applyPartnerCode, makeShareCode } from '../src/game/share.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

// ----- the rule ------------------------------------------------------------

test('Together is the pair realm; the other four are solo realms', () => {
  assert.equal(isPairRealm('together'), true)
  assert.equal(isPairRealm('health'), false)
  assert.deepEqual(
    SOLO_REALMS.map((realm) => realm.id),
    ['health', 'mind', 'wealth', 'questAbroad'],
  )
})

test('Together cannot be logged alone', () => {
  const save = newSave('rachit')
  assert.equal(logAction(save, 'together', 25, nov(9)), save) // nothing happens
  assert.equal(logAction(save, 'health', 25, nov(9)).realmXp.health, 25)
})

test('Together cannot be given dailies', () => {
  const save = newSave('rachit')
  assert.equal(canAddDaily(save, 'together'), false)
  assert.equal(addDaily(save, 'together', 'Hold hands', 10, nov(9)), save)
})

test('a confirmed party quest is how Together earns XP', () => {
  const rachit = logPartyQuest(newSave('rachit'), 'party-1', nov(12))
  let deepika = applyPartnerCode(
    newSave('deepika'),
    makeShareCode(rachit, nov(12, 20)),
    nov(12, 20),
  ).save
  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13))
  assert.equal(deepika.realmXp.together, 25)
})

test('a Together challenge counts days with a confirmed party quest', () => {
  const rachit = logPartyQuest(newSave('rachit'), 'party-1', nov(12))
  let deepika = addChallenge(
    newSave('deepika'),
    {
      realm: 'together',
      name: 'Time together',
      dailyId: null,
      tiers: [{ name: 'Start', daysPerWeek: 1, weeks: 2 }],
    },
    nov(9),
  )
  deepika = applyPartnerCode(deepika, makeShareCode(rachit, nov(12, 20)), nov(12, 20)).save
  assert.equal(activeDaysInWeek(deepika, deepika.challenges[0], weekKey(nov(13))), 0)

  deepika = confirmPartyLog(deepika, deepika.partyLogs[0].id, nov(13))
  assert.equal(activeDaysInWeek(deepika, deepika.challenges[0], weekKey(nov(13))), 1)
})

// ----- upgrading an older save ---------------------------------------------

// A version 9 save, as it looked before Together became pair-only: with
// Together dailies, Together XP, and a challenge counting one of them.
function versionNineSave() {
  const old = JSON.parse(saveToText(newSave('rachit')))
  old.version = 9
  old.realmXp.together = 130
  old.dailies.push(
    { id: 'daily-together-1', realm: 'together', name: 'Phone-free time', xp: 10 },
    { id: 'daily-together-2', realm: 'together', name: 'Date night', xp: 25 },
  )
  old.log.push({
    realm: 'together',
    xp: 10,
    at: nov(10).toISOString(),
    dailyId: 'daily-together-1',
  })
  old.challenges.push({
    id: 'c1',
    realm: 'together',
    name: 'Time together',
    dailyId: 'daily-together-1',
    tiers: [{ name: 'Start', daysPerWeek: 2, weeks: 2 }],
    tierIndex: 0,
    weeksDone: 1,
    lastCountedWeek: '2026-11-09',
    startedWeek: '2026-11-02',
  })
  return old
}

test('upgrading turns Together dailies into party quests', () => {
  const upgraded = parseSave(JSON.stringify(versionNineSave()))
  assert.equal(upgraded?.version, SAVE_VERSION)

  // No Together dailies are left; the other realms keep theirs.
  assert.equal(upgraded?.dailies.some((d) => d.realm === 'together'), false)
  assert.equal(upgraded?.dailies.length, 4)

  // "Phone-free time" is a new party quest. "Date night" was already one,
  // so it is not added twice.
  const names = upgraded?.partyQuests.map((q) => q.name) ?? []
  assert.equal(names.includes('Phone-free time'), true)
  assert.equal(names.filter((name) => name === 'Date night').length, 1)
})

test('upgrading keeps Together XP, the log and challenge progress', () => {
  const upgraded = parseSave(JSON.stringify(versionNineSave()))
  assert.equal(upgraded?.realmXp.together, 130)
  assert.equal(upgraded?.log.length, 1)

  // The challenge now counts anything in the realm, and keeps its week.
  const challenge = upgraded?.challenges[0]
  assert.equal(challenge?.dailyId, null)
  assert.equal(challenge?.weeksDone, 1)
})

test('upgrading never overfills the party quest list', () => {
  const old = versionNineSave()
  for (let i = 0; old.partyQuests.length < MAX_PARTY_QUESTS; i++) {
    old.partyQuests.push({ id: `extra-${i}`, name: `Extra ${i}` })
  }
  const upgraded = parseSave(JSON.stringify(old))
  assert.equal(upgraded?.partyQuests.length, MAX_PARTY_QUESTS)
  assert.equal(upgraded?.dailies.some((d) => d.realm === 'together'), false)
})

test('an old Together daily can no longer be ticked', () => {
  // A save that somehow still holds a Together daily.
  const save = newSave('rachit')
  const odd = {
    ...save,
    dailies: [
      ...save.dailies,
      { id: 'daily-together-9', realm: 'together' as const, name: 'Old one', xp: 10 },
    ],
  }
  assert.equal(completeDaily(odd, 'daily-together-9', nov(9)), odd)
})
