// TESTS for the map milestones: titles, mountain art, explorer quests and
// bucket-list trophies.
// Run them with:  npm test
//
// The places are well-known towns, not anyone's travel history.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addExplorerQuests,
  bucketTrophies,
  mapMilestones,
  mapTitles,
  newlyReached,
  reachedMilestones,
} from '../src/game/mapMilestones.ts'
import { addPin } from '../src/game/pins.ts'
import type { PinInput } from '../src/game/pins.ts'
import { EXPLORER_PARTY_QUESTS, MAX_PARTY_QUESTS } from '../src/game/rules.ts'
import { newSave } from '../src/storage/save.ts'
import type { Pin, SaveData } from '../src/storage/save.ts'

function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

// A place in a given state, at a given height.
function place(name: string, stateId: string, metres: number): PinInput {
  return {
    name,
    date: '2026-11-01',
    bucketList: false,
    lon: 77,
    lat: 20,
    stateId,
    stateName: stateId,
    metres,
    terrain: metres >= 1500 ? 'mountains' : 'plains',
  }
}

// Drops the pins, then marks them all as confirmed by the partner.
function together(inputs: PinInput[]): SaveData {
  let save = newSave('rachit')
  inputs.forEach((input, index) => {
    save = addPin(save, input, nov(16, 9 + index))
  })
  return { ...save, pins: save.pins.map((pin): Pin => ({ ...pin, state: 'confirmed' })) }
}

test('a new save has reached no milestones', () => {
  const save = newSave('rachit')
  assert.deepEqual(reachedMilestones(save), [])
  assert.deepEqual(mapTitles(save), [])
  assert.equal(mapMilestones(save).length, 5)
})

test('only confirmed pins count', () => {
  const waiting = addPin(newSave('rachit'), place('Shimla', 'himachal-pradesh', 2200), nov(16))
  assert.deepEqual(reachedMilestones(waiting), [])

  const confirmed = together([place('Shimla', 'himachal-pradesh', 2200)])
  assert.deepEqual(reachedMilestones(confirmed), ['firstPin'])
  assert.deepEqual(mapTitles(confirmed), ['Wanderers'])
})

test('three mountain destinations unlock the mountain art', () => {
  const two = together([
    place('Shimla', 'himachal-pradesh', 2200),
    place('Mussoorie', 'uttarakhand', 2000),
    place('Jaipur', 'rajasthan', 430), // not a mountain
  ])
  const mountains = mapMilestones(two).find((m) => m.id === 'mountains')
  assert.equal(mountains?.have, 2)
  assert.equal(mountains?.done, false)

  const three = together([
    place('Shimla', 'himachal-pradesh', 2200),
    place('Mussoorie', 'uttarakhand', 2000),
    place('Gangtok', 'sikkim', 1650),
  ])
  assert.ok(reachedMilestones(three).includes('mountains'))
})

test('five different states give "Desi Explorers"; repeats in one state count once', () => {
  const fourStates = together([
    place('Agra', 'uttar-pradesh', 170),
    place('Varanasi', 'uttar-pradesh', 80),
    place('Jaipur', 'rajasthan', 430),
    place('Pune', 'maharashtra', 560),
    place('Kochi', 'kerala', 5),
  ])
  assert.equal(mapMilestones(fourStates).find((m) => m.id === 'states')?.have, 4)

  const five = together([
    place('Agra', 'uttar-pradesh', 170),
    place('Jaipur', 'rajasthan', 430),
    place('Pune', 'maharashtra', 560),
    place('Kochi', 'kerala', 5),
    place('Panaji', 'goa', 10),
  ])
  assert.deepEqual(mapTitles(five), ['Wanderers', 'Desi Explorers'])
})

test('the explorer party quests are added once the five states are reached', () => {
  const four = together([place('Agra', 'uttar-pradesh', 170)])
  assert.equal(addExplorerQuests(four, nov(16)), four) // not unlocked yet

  const five = together([
    place('Agra', 'uttar-pradesh', 170),
    place('Jaipur', 'rajasthan', 430),
    place('Pune', 'maharashtra', 560),
    place('Kochi', 'kerala', 5),
    place('Panaji', 'goa', 10),
  ])
  const added = addExplorerQuests(five, nov(16))
  const names = added.partyQuests.map((quest) => quest.name)
  for (const name of EXPLORER_PARTY_QUESTS) assert.ok(names.includes(name))
  assert.ok(added.partyQuests.length <= MAX_PARTY_QUESTS)
  // Doing it again adds nothing.
  assert.equal(addExplorerQuests(added, nov(17)), added)
})

test('a bucket-list place gives a trophy', () => {
  const save = together([{ ...place('Ladakh', 'ladakh', 3500), bucketList: true }])
  assert.ok(reachedMilestones(save).includes('bucketList'))
  assert.deepEqual(bucketTrophies(save).map((pin) => pin.name), ['Ladakh'])
})

test('newly reached milestones are found for the celebration card', () => {
  const before = addPin(newSave('rachit'), place('Shimla', 'himachal-pradesh', 2200), nov(16))
  const after: SaveData = {
    ...before,
    pins: before.pins.map((pin): Pin => ({ ...pin, state: 'confirmed' })),
  }
  assert.deepEqual(newlyReached(before, after).map((m) => m.id), ['firstPin'])
  assert.deepEqual(newlyReached(after, after), [])
})
