// TESTS for the map: finding places, terrain types, and pins.
// Run them with:  npm test
//
// The places used here are well-known towns, chosen only because their
// positions are easy to look up. They are not anyone's travel history.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeHeight,
  gridToLonLat,
  isMountainHeight,
  lonLatToGrid,
  metresFromCode,
  stateAt,
  terrainFor,
} from '../src/game/geo.ts'
import {
  addPin,
  canAddPin,
  isVisitDate,
  pinsNewestFirst,
  removePin,
  updatePin,
} from '../src/game/pins.ts'
import type { PinInput } from '../src/game/pins.ts'
import { MAX_PINS } from '../src/game/rules.ts'
import { INDIA_MAP } from '../src/map/india.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

// The state a place on the Earth is in (its id), or null outside India.
function stateOf(lat: number, lon: number): string | null {
  return stateAt(lonLatToGrid(lon, lat))?.id ?? null
}

// ----- positions -----------------------------------------------------------

test('the corners of the map line up with its edges on the Earth', () => {
  const [left, top] = lonLatToGrid(INDIA_MAP.west, INDIA_MAP.north)
  const [right, bottom] = lonLatToGrid(INDIA_MAP.east, INDIA_MAP.south)
  assert.ok(Math.abs(left) < 0.001 && Math.abs(top) < 0.001)
  assert.ok(Math.abs(right - INDIA_MAP.width) < 0.001)
  assert.ok(Math.abs(bottom - INDIA_MAP.height) < 0.001)
})

test('a place turned into a grid point and back is the same place', () => {
  const back = gridToLonLat(lonLatToGrid(77.17, 31.1))
  assert.ok(Math.abs(back.lon - 77.17) < 0.0001)
  assert.ok(Math.abs(back.lat - 31.1) < 0.0001)
})

// ----- which state ---------------------------------------------------------

test('well-known towns are found in the right state', () => {
  assert.equal(stateOf(31.1, 77.17), 'himachal-pradesh') // Shimla
  assert.equal(stateOf(13.08, 80.27), 'tamil-nadu') // Chennai
  assert.equal(stateOf(26.91, 75.79), 'rajasthan') // Jaipur
  assert.equal(stateOf(26.14, 91.74), 'assam') // Guwahati
  assert.equal(stateOf(34.15, 77.58), 'ladakh') // Leh
  assert.equal(stateOf(15.49, 73.83), 'goa') // Panaji
  assert.equal(stateOf(19.08, 72.88), 'maharashtra') // Mumbai, right on the coast
  assert.equal(stateOf(11.62, 92.73), 'andaman-and-nicobar') // Port Blair
})

test('places outside India have no state', () => {
  assert.equal(stateOf(6.93, 79.86), null) // Colombo
  assert.equal(stateOf(27.7, 85.32), null) // Kathmandu
  assert.equal(stateOf(15.0, 88.0), null) // the middle of the Bay of Bengal
})

test('the far north, inside the outline but outside the state shapes, gets the nearest state', () => {
  const state = stateOf(35.2, 79.5)
  assert.equal(state, 'ladakh')

  const northWest = stateOf(35.92, 74.31)
  assert.ok(northWest === 'ladakh' || northWest === 'jammu-and-kashmir')
})

// ----- heights and terrain -------------------------------------------------

test('height codes turn back into metres', () => {
  assert.equal(metresFromCode(0), 0) // the sea
  assert.equal(metresFromCode(1), 0) // land barely above it
  // The code for about 2,000 m is sqrt(2000) x 2.7 = 121.
  assert.ok(Math.abs(metresFromCode(121) - 2000) < 30)
  // The biggest code covers the highest peaks.
  assert.ok(metresFromCode(255) > 8800)
})

test('heights are shown rounded to the nearest 10 m', () => {
  assert.equal(describeHeight(2047), 'about 2,050 m')
  assert.equal(describeHeight(8), 'about 10 m')
})

test('terrain type follows the height', () => {
  const inland = { nearSea: false, stateId: 'karnataka' }
  assert.equal(terrainFor({ ...inland, metres: 120 }), 'plains')
  assert.equal(terrainFor({ ...inland, metres: 600 }), 'plateau')
  assert.equal(terrainFor({ ...inland, metres: 1200 }), 'hills')
  assert.equal(terrainFor({ ...inland, metres: 1500 }), 'mountains')
  assert.equal(terrainFor({ ...inland, metres: 3499 }), 'mountains')
  assert.equal(terrainFor({ ...inland, metres: 3500 }), 'highMountains')
})

test('low land by the sea is coast; high land by the sea is not', () => {
  assert.equal(terrainFor({ metres: 20, nearSea: true, stateId: 'goa' }), 'coast')
  assert.equal(terrainFor({ metres: 20, nearSea: false, stateId: 'goa' }), 'plains')
  assert.equal(terrainFor({ metres: 900, nearSea: true, stateId: 'kerala' }), 'hills')
})

test('anywhere in the island territories is an island', () => {
  assert.equal(
    terrainFor({ metres: 300, nearSea: true, stateId: 'andaman-and-nicobar' }),
    'island',
  )
  assert.equal(terrainFor({ metres: 2, nearSea: true, stateId: 'lakshadweep' }), 'island')
})

test('a mountain destination is 1,500 m or higher', () => {
  assert.equal(isMountainHeight(1499), false)
  assert.equal(isMountainHeight(1500), true)
})

// ----- pins ----------------------------------------------------------------

// What the Map screen would hand over for a pin on a hill station.
const HILL_STATION: PinInput = {
  name: 'Hill station',
  date: '2026-11-07',
  bucketList: false,
  lon: 77.17,
  lat: 31.1,
  stateId: 'himachal-pradesh',
  stateName: 'Himachal Pradesh',
  metres: 2047.6,
  terrain: 'mountains',
}

test('adding a pin keeps what the map worked out, and it waits to be shared', () => {
  const save = addPin(newSave('rachit'), HILL_STATION, nov(16))
  assert.equal(save.pins.length, 1)

  const pin = save.pins[0]
  assert.equal(pin.name, 'Hill station')
  assert.equal(pin.stateName, 'Himachal Pradesh')
  assert.equal(pin.metres, 2048) // stored as a whole number
  assert.equal(pin.terrain, 'mountains')
  assert.equal(pin.by, 'rachit')
  assert.equal(pin.state, 'pending')
  // A pin pays nothing by itself.
  assert.equal(save.realmXp.together, 0)
})

test('a pin needs a name and a real date that is not in the future', () => {
  const save = newSave('rachit')
  assert.equal(addPin(save, { ...HILL_STATION, name: '   ' }, nov(16)), save)
  assert.equal(addPin(save, { ...HILL_STATION, date: '2026-11-17' }, nov(16)), save)

  assert.equal(isVisitDate('2026-11-16', nov(16)), true) // today is fine
  assert.equal(isVisitDate('2026-02-31', nov(16)), false) // no such day
  assert.equal(isVisitDate('last week', nov(16)), false)
})

test('a pin can be renamed and re-dated, but not moved', () => {
  let save = addPin(newSave('rachit'), HILL_STATION, nov(16))
  const id = save.pins[0].id

  save = updatePin(save, id, { name: 'Our hill station', date: '2026-10-30', bucketList: true }, nov(16))
  assert.equal(save.pins[0].name, 'Our hill station')
  assert.equal(save.pins[0].date, '2026-10-30')
  assert.equal(save.pins[0].bucketList, true)
  assert.equal(save.pins[0].lat, 31.1) // still where it was

  // Saving with nothing changed hands back the very same save.
  const same = updatePin(save, id, { name: 'Our hill station', date: '2026-10-30', bucketList: true }, nov(16))
  assert.equal(same, save)
})

test('a pin can be removed', () => {
  let save = addPin(newSave('rachit'), HILL_STATION, nov(16))
  save = removePin(save, save.pins[0].id)
  assert.deepEqual(save.pins, [])
  assert.equal(removePin(save, 'no-such-pin'), save)
})

test('the pin list shows the latest visit first', () => {
  let save = addPin(newSave('rachit'), { ...HILL_STATION, name: 'Older', date: '2026-03-01' }, nov(16))
  save = addPin(save, { ...HILL_STATION, name: 'Newer', date: '2026-11-07' }, nov(16, 10))
  assert.deepEqual(
    pinsNewestFirst(save).map((pin) => pin.name),
    ['Newer', 'Older'],
  )
})

test('there is a limit on how many pins a save holds', () => {
  let save = newSave('rachit')
  for (let i = 0; i < MAX_PINS; i++) {
    // Each pin is added one second after the last, on 20 November (after
    // the visit date, so the date is accepted).
    save = addPin(save, HILL_STATION, new Date(2026, 10, 20, 0, 0, i))
  }
  assert.equal(save.pins.length, MAX_PINS)
  assert.equal(canAddPin(save), false)
  assert.equal(addPin(save, HILL_STATION, nov(21)), save)
  // Every pin still has an id of its own.
  assert.equal(new Set(save.pins.map((pin) => pin.id)).size, MAX_PINS)
})

// ----- saving --------------------------------------------------------------

test('pins survive export and import', () => {
  const save = addPin(newSave('rachit'), { ...HILL_STATION, bucketList: true }, nov(16))
  assert.deepEqual(parseSave(saveToText(save)), save)
})

test('a version 10 save is upgraded with no pins', () => {
  const old = JSON.parse(saveToText(newSave('deepika')))
  old.version = 10
  delete old.pins

  const upgraded = parseSave(JSON.stringify(old))
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.deepEqual(upgraded?.pins, [])
})

test('a damaged pin is dropped without losing the rest', () => {
  const save = addPin(newSave('rachit'), HILL_STATION, nov(16))
  const damaged = JSON.parse(saveToText(save))
  damaged.pins.push({ id: 'broken', name: 'No position' })
  assert.equal(parseSave(JSON.stringify(damaged))?.pins.length, 1)
})
