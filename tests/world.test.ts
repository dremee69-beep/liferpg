// TESTS for the world map: finding the country under a tap, and pins abroad.
// Run them with:  npm test
//
// The places are capital cities, not anyone's travel history.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAbroadPin, mapTitles, reachedMilestones } from '../src/game/mapMilestones.ts'
import { addPin } from '../src/game/pins.ts'
import {
  abroadStateId,
  countryAt,
  worldGridToLonLat,
  worldLonLatToGrid,
} from '../src/game/world.ts'
import { WORLD_MAP } from '../src/map/world.ts'
import { newSave } from '../src/storage/save.ts'
import type { Pin } from '../src/storage/save.ts'

// The country under a longitude and latitude.
function countryOf(lon: number, lat: number): string | undefined {
  return countryAt(WORLD_MAP.countries, worldLonLatToGrid(WORLD_MAP, lon, lat))?.id
}

test('a place on the world map turns back into the same place', () => {
  const [x, y] = worldLonLatToGrid(WORLD_MAP, 2.35, 48.86) // Paris
  const back = worldGridToLonLat(WORLD_MAP, [x, y])
  assert.ok(Math.abs(back.lon - 2.35) < 1e-9)
  assert.ok(Math.abs(back.lat - 48.86) < 1e-9)
})

test('a tap finds the right country', () => {
  assert.equal(countryOf(2.35, 48.86), 'fr') // Paris
  assert.equal(countryOf(100.5, 13.75), 'th') // Bangkok
  assert.equal(countryOf(139.7, 35.7), 'jp') // Tokyo
  assert.equal(countryOf(-104.99, 39.74), 'us') // Denver
  assert.equal(countryOf(77.2, 28.6), 'in') // New Delhi
  assert.equal(countryOf(-30, 0), undefined) // the middle of the Atlantic
})

test('tiny island countries can still be tapped', () => {
  for (const id of ['mv', 'sg']) {
    const country = WORLD_MAP.countries.find((c) => c.id === id)
    assert.ok(country, `${id} is on the map`)
    const [left, top, width, height] = country.box
    const middle = [left + width / 2, top + height / 2] as const
    assert.equal(countryAt(WORLD_MAP.countries, middle)?.id, id)
  }
})

test('a pin abroad counts for "first trip abroad", not for Indian states', () => {
  let save = addPin(
    newSave('rachit'),
    {
      name: 'Paris',
      date: '2026-05-01',
      bucketList: false,
      lon: 2.35,
      lat: 48.86,
      stateId: abroadStateId('fr'),
      stateName: 'France',
      metres: 35,
      terrain: 'plains',
    },
    new Date(2026, 10, 16),
  )
  assert.equal(isAbroadPin(save.pins[0]), true)
  save = { ...save, pins: save.pins.map((pin): Pin => ({ ...pin, state: 'confirmed' })) }
  assert.ok(reachedMilestones(save).includes('abroad'))
  assert.ok(!reachedMilestones(save).includes('states'))
  assert.ok(mapTitles(save).includes('Globetrotters'))
})

test('a seaside town just off the simplified coast still finds its country', () => {
  assert.equal(countryOf(-74.0, 40.7), 'us') // New York
  assert.equal(countryOf(2.17, 41.39), 'es') // Barcelona
})
