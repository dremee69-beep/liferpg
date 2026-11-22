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
  confirmPin,
  declinePin,
  isVisitDate,
  pinsForCode,
  pinsNewestFirst,
  removePin,
  updatePin,
} from '../src/game/pins.ts'
import { iconForTerrain, isPinPhoto, markerIconOf } from '../src/game/markers.ts'
import type { PinInput } from '../src/game/pins.ts'
import { applyPartnerCode, makeShareCode } from '../src/game/share.ts'
import { MAX_PIN_PHOTO_CHARS, MAX_PINS } from '../src/game/rules.ts'
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

// ---------- Pin markers: icon or photo ----------

// A stand-in for a small photo: the right kind of text, not a real picture.
const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(8000)

test('a pin with no icon picked gets one from its terrain', () => {
  assert.equal(iconForTerrain('mountains'), 'mountain')
  assert.equal(iconForTerrain('highMountains'), 'mountain')
  assert.equal(iconForTerrain('coast'), 'beach')
  assert.equal(iconForTerrain('island'), 'beach')
  assert.equal(iconForTerrain('plains'), 'city')
  assert.equal(iconForTerrain('hills'), 'nature')

  const save = addPin(newSave('rachit'), HILL_STATION, nov(16))
  assert.equal(save.pins[0].icon, undefined)
  assert.equal(markerIconOf(save.pins[0]), 'mountain')
})

test('a pin keeps the icon and photo picked for it', () => {
  const save = addPin(
    newSave('rachit'),
    { ...HILL_STATION, icon: 'heart', photo: PHOTO },
    nov(16),
  )
  assert.equal(save.pins[0].icon, 'heart')
  assert.equal(save.pins[0].photo, PHOTO)
  assert.equal(markerIconOf(save.pins[0]), 'heart')
})

test('a photo that is not a small JPEG is not kept', () => {
  assert.equal(isPinPhoto(PHOTO), true)
  assert.equal(isPinPhoto('data:image/png;base64,AAAA'), false)
  assert.equal(isPinPhoto('data:image/jpeg;base64,' + 'A'.repeat(MAX_PIN_PHOTO_CHARS)), false)

  const save = addPin(newSave('rachit'), { ...HILL_STATION, photo: 'not a photo' }, nov(16))
  assert.equal(save.pins.length, 1) // the pin is still added...
  assert.equal(save.pins[0].photo, undefined) // ...without the photo
})

test('editing a pin can change or remove its icon and photo', () => {
  let save = addPin(newSave('rachit'), { ...HILL_STATION, photo: PHOTO }, nov(16))
  const id = save.pins[0].id
  const details = { name: 'Hill station', date: '2026-11-07', bucketList: false }

  save = updatePin(save, id, { ...details, icon: 'star', photo: null }, nov(16))
  assert.equal(save.pins[0].photo, undefined)
  assert.equal(save.pins[0].icon, 'star')

  save = updatePin(save, id, { ...details, icon: null, photo: null }, nov(16))
  assert.equal(save.pins[0].icon, undefined)
  assert.equal(markerIconOf(save.pins[0]), 'mountain') // back to the terrain icon

  // Nothing changed: the very same save comes back.
  assert.equal(updatePin(save, id, { ...details, icon: null, photo: null }, nov(16)), save)
})

test('icons and photos survive saving and loading; damaged ones are dropped', () => {
  const save = addPin(
    newSave('rachit'),
    { ...HILL_STATION, icon: 'temple', photo: PHOTO },
    nov(16),
  )
  const loaded = parseSave(saveToText(save))
  assert.equal(loaded?.pins[0].icon, 'temple')
  assert.equal(loaded?.pins[0].photo, PHOTO)

  const damaged = JSON.parse(saveToText(save))
  damaged.pins[0].icon = 'spaceship'
  damaged.pins[0].photo = 12
  const pin = parseSave(JSON.stringify(damaged))?.pins[0]
  assert.equal(pin?.name, 'Hill station') // the pin is kept
  assert.equal(pin?.icon, undefined)
  assert.equal(pin?.photo, undefined)
})

test('a version 11 save keeps its pins, which get terrain icons', () => {
  const old = JSON.parse(saveToText(addPin(newSave('deepika'), HILL_STATION, nov(16))))
  old.version = 11
  const upgraded = parseSave(JSON.stringify(old))
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.equal(upgraded?.pins.length, 1)
  assert.equal(markerIconOf(upgraded!.pins[0]), 'mountain')
})

// ---------- Sharing pins through share codes ----------

test('the whole journey: drop, send, confirm, send back', () => {
  // Rachit drops a pin, with a photo.
  let rachit = addPin(newSave('rachit'), { ...HILL_STATION, photo: PHOTO }, nov(16))
  const id = rachit.pins[0].id

  // Deepika reads his code: the pin arrives, waiting for her, without the photo.
  let deepika = newSave('deepika')
  const arrived = applyPartnerCode(deepika, makeShareCode(rachit, nov(16, 10)), nov(16, 10))
  deepika = arrived.save
  assert.deepEqual(arrived.pinNews.toConfirm.map((pin) => pin.name), ['Hill station'])
  assert.equal(deepika.pins[0].state, 'pending')
  assert.equal(deepika.pins[0].by, 'rachit')
  assert.equal(deepika.pins[0].photo, undefined)

  // She confirms it. Her code carries the answer back.
  deepika = confirmPin(deepika, id)
  assert.equal(deepika.pins[0].state, 'confirmed')
  const back = applyPartnerCode(rachit, makeShareCode(deepika, nov(16, 11)), nov(16, 11))
  rachit = back.save
  assert.equal(rachit.pins[0].state, 'confirmed')
  assert.equal(rachit.pins[0].photo, PHOTO) // his photo is still on his phone
  assert.deepEqual(back.pinNews.confirmed.map((pin) => pin.name), ['Hill station'])
})

test('reading the same code twice adds a pin only once', () => {
  const rachit = addPin(newSave('rachit'), HILL_STATION, nov(16))
  const code = makeShareCode(rachit, nov(16, 10))
  let deepika = applyPartnerCode(newSave('deepika'), code, nov(16, 10)).save
  const again = applyPartnerCode(deepika, code, nov(16, 10))
  deepika = again.save
  assert.equal(deepika.pins.length, 1)
  assert.deepEqual(again.pinNews.toConfirm, [])
})

test('a declined pin is marked on both phones and leaves the code', () => {
  let rachit = addPin(newSave('rachit'), HILL_STATION, nov(16))
  const id = rachit.pins[0].id
  let deepika = applyPartnerCode(newSave('deepika'), makeShareCode(rachit, nov(16, 10)), nov(16, 10)).save
  deepika = declinePin(deepika, id)
  assert.equal(deepika.pins[0].state, 'declined')

  const back = applyPartnerCode(rachit, makeShareCode(deepika, nov(16, 11)), nov(16, 11))
  rachit = back.save
  assert.equal(rachit.pins[0].state, 'declined')
  assert.deepEqual(back.pinNews.declined.map((pin) => pin.name), ['Hill station'])
  // Decided pins no longer travel from his phone.
  assert.deepEqual(pinsForCode(rachit), [])
})

test("you cannot confirm, decline or edit your own pin, nor edit your partner's", () => {
  const rachit = addPin(newSave('rachit'), HILL_STATION, nov(16))
  const id = rachit.pins[0].id
  assert.equal(confirmPin(rachit, id), rachit)
  assert.equal(declinePin(rachit, id), rachit)

  const deepika = applyPartnerCode(newSave('deepika'), makeShareCode(rachit, nov(16, 10)), nov(16, 10)).save
  const details = { name: 'Renamed', date: '2026-11-07', bucketList: false }
  assert.equal(updatePin(deepika, id, details, nov(16)), deepika)
})

test('a pin removed before the answer arrives stays removed', () => {
  let rachit = addPin(newSave('rachit'), HILL_STATION, nov(16))
  const id = rachit.pins[0].id
  let deepika = applyPartnerCode(newSave('deepika'), makeShareCode(rachit, nov(16, 10)), nov(16, 10)).save
  deepika = confirmPin(deepika, id)
  rachit = removePin(rachit, id)
  rachit = applyPartnerCode(rachit, makeShareCode(deepika, nov(16, 11)), nov(16, 11)).save
  assert.deepEqual(rachit.pins, [])
})

test('a share code carries no photos and only pins with news', () => {
  let save = addPin(newSave('rachit'), { ...HILL_STATION, photo: PHOTO }, nov(16))
  save = { ...save, pins: [...save.pins, { ...save.pins[0], id: 'old', state: 'confirmed' }] }
  const sent = pinsForCode(save)
  assert.equal(sent.length, 1) // the confirmed one has no news
  assert.equal(sent[0].photo, undefined)
  assert.ok(!makeShareCode(save, nov(16)).includes('data:image'))
})
