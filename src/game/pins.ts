// MAP PINS
// A pin marks a place the two of you visited together. The Map screen works
// out where it is, how high and what terrain (see geo.ts and
// src/map/heights.ts); this file keeps the list of pins in the save.
//
// Only places you visited TOGETHER go on the shared map, so a new pin waits
// ("pending") until your partner confirms it. Like party quests (party.ts),
// this travels through share codes:
//   1. You drop a pin. It shows on your map, waiting.
//   2. Your next share code carries it to your partner (without the photo:
//      photos stay on the phone that took them).
//   3. Your partner confirms it (or declines it) on their Map screen.
//   4. Their next share code carries the answer back to your phone.
//
// Like the other game files, nothing here changes the save it is given: each
// function hands back a fresh copy, or the very same save when nothing changed.

import { dayKey } from './dates.ts'
import type { TerrainId } from './geo.ts'
import { isMarkerIcon, isPinPhoto } from './markers.ts'
import type { MarkerIconId } from './markers.ts'
import { MAX_PIN_NAME_LENGTH, MAX_PINS, PINS_IN_CODE } from './rules.ts'
import type { Pin, SaveData } from '../storage/save.ts'

// What the Map screen hands over to create a pin. The player types the
// name, date and bucket-list tick; the rest is worked out from the tap.
export type PinInput = {
  name: string
  date: string // the day you went, as a day key like "2026-11-14"
  bucketList: boolean
  lon: number
  lat: number
  stateId: string
  stateName: string
  metres: number
  terrain: TerrainId
} & PinLook

// How a pin looks on the map: an icon the player picked (null or left out =
// pick one from the terrain), and a small photo (null or left out = none).
// See markers.ts.
export type PinLook = {
  icon?: MarkerIconId | null
  photo?: string | null
}

// The look as stored in a pin: only the parts that are set, and only if
// they look right.
function lookFields(look: PinLook): { icon?: MarkerIconId; photo?: string } {
  return {
    ...(isMarkerIcon(look.icon) ? { icon: look.icon } : {}),
    ...(isPinPhoto(look.photo) ? { photo: look.photo } : {}),
  }
}

// Tidies a typed place name. Returns null when nothing is left.
export function cleanPinName(typed: string): string | null {
  const name = typed.trim().slice(0, MAX_PIN_NAME_LENGTH).trim()
  return name === '' ? null : name
}

// A visit date must be a real day, and not in the future.
export function isVisitDate(date: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split('-').map(Number)
  const real = new Date(year, month - 1, day)
  // new Date() quietly turns "31 February" into March: check it came back
  // as the same day.
  if (dayKey(real) !== date) return false
  return date <= dayKey(now)
}

export function canAddPin(save: SaveData): boolean {
  return save.pins.length < MAX_PINS
}

export function addPin(save: SaveData, input: PinInput, now: Date): SaveData {
  const name = cleanPinName(input.name)
  if (name === null || !isVisitDate(input.date, now) || !canAddPin(save)) {
    return save
  }

  // The id starts with who dropped it, so the two phones can never make the
  // same id by accident.
  let id = `pin-${save.player}-${now.getTime().toString(36)}`
  while (save.pins.some((pin) => pin.id === id)) id = `${id}x`

  const pin: Pin = {
    id,
    name,
    date: input.date,
    bucketList: input.bucketList,
    lon: input.lon,
    lat: input.lat,
    stateId: input.stateId,
    stateName: input.stateName,
    metres: Math.max(0, Math.round(input.metres)),
    terrain: input.terrain,
    by: save.player,
    state: 'pending',
    ...lookFields(input),
  }
  return { ...save, pins: [...save.pins, pin] }
}

// Change a pin's name, date, bucket-list tick, icon or photo. Where it is
// cannot be changed: to move a pin, remove it and drop it again.
export function updatePin(
  save: SaveData,
  pinId: string,
  changes: { name: string; date: string; bucketList: boolean } & PinLook,
  now: Date,
): SaveData {
  const old = save.pins.find((pin) => pin.id === pinId)
  const name = cleanPinName(changes.name)
  if (old === undefined || name === null || !isVisitDate(changes.date, now)) {
    return save
  }
  // Only the player who dropped a pin can change it.
  if (old.by !== save.player) return save
  const look = lookFields(changes)
  if (
    old.name === name &&
    old.date === changes.date &&
    old.bucketList === changes.bucketList &&
    old.icon === look.icon &&
    old.photo === look.photo
  ) {
    return save // nothing is different
  }
  // Start from the pin without its old look, then add the new one.
  const { icon: _oldIcon, photo: _oldPhoto, ...rest } = old
  const updated: Pin = {
    ...rest,
    name,
    date: changes.date,
    bucketList: changes.bucketList,
    ...look,
  }
  return { ...save, pins: save.pins.map((pin) => (pin.id === pinId ? updated : pin)) }
}

export function removePin(save: SaveData, pinId: string): SaveData {
  if (!save.pins.some((pin) => pin.id === pinId)) return save
  return { ...save, pins: save.pins.filter((pin) => pin.id !== pinId) }
}

// The pins in the order the list shows them: latest visit first.
export function pinsNewestFirst(save: SaveData): Pin[] {
  return [...save.pins].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// ---------------------------------------------------------------------------
// Sharing pins with your partner
// ---------------------------------------------------------------------------

// Swap one pin for a changed copy.
function withPin(save: SaveData, changed: Pin): SaveData {
  return { ...save, pins: save.pins.map((pin) => (pin.id === changed.id ? changed : pin)) }
}

// A copy of a pin without its photo (photos never leave the phone).
function withoutPhoto(pin: Pin): Pin {
  const { photo: _photo, ...rest } = pin
  return rest
}

// Confirm a pin your PARTNER dropped: yes, we went there together.
// Does nothing for your own pins, or ones already decided.
export function confirmPin(save: SaveData, pinId: string): SaveData {
  const pin = save.pins.find((p) => p.id === pinId)
  if (pin === undefined || pin.by === save.player || pin.state !== 'pending') return save
  return withPin(save, { ...pin, state: 'confirmed' })
}

// Say no to a pin your partner dropped (for example, a solo trip).
export function declinePin(save: SaveData, pinId: string): SaveData {
  const pin = save.pins.find((p) => p.id === pinId)
  if (pin === undefined || pin.by === save.player || pin.state !== 'pending') return save
  return withPin(save, { ...pin, state: 'declined' })
}

// The pins that travel in a share code: the ones with news for the partner.
//   - yours that are still waiting for them to confirm;
//   - theirs that you have confirmed or declined, so their phone learns.
// The newest few only, and never the photo.
export function pinsForCode(save: SaveData): Pin[] {
  return save.pins
    .filter((pin) =>
      pin.by === save.player ? pin.state === 'pending' : pin.state !== 'pending',
    )
    .slice(-PINS_IN_CODE)
    .map(withoutPhoto)
}

// What changed when a partner's code was read.
export type PinNews = {
  toConfirm: Pin[] // new pins the partner dropped, waiting for you
  confirmed: Pin[] // your pins the partner confirmed
  declined: Pin[] // your pins the partner declined
}

export const NO_PIN_NEWS: PinNews = { toConfirm: [], confirmed: [], declined: [] }

// Take in the pins from a partner's share code.
//   - A pin THEY dropped that this phone has not seen is added, waiting for
//     you to confirm (if there is room).
//   - A pin YOU dropped that they confirmed or declined is marked so here.
//     If you have removed that pin since, nothing happens.
// Everything else is left as it is, so reading the same code twice changes
// nothing the second time.
export function mergePins(
  save: SaveData,
  incoming: Pin[],
): { save: SaveData; news: PinNews } {
  const news: PinNews = { toConfirm: [], confirmed: [], declined: [] }
  let next = save

  for (const theirs of incoming) {
    const mine = next.pins.find((pin) => pin.id === theirs.id)

    if (theirs.by !== save.player) {
      // Dropped by the partner. Only news if this phone has never seen it.
      if (mine === undefined && theirs.state === 'pending' && canAddPin(next)) {
        const arrived = withoutPhoto(theirs)
        next = { ...next, pins: [...next.pins, arrived] }
        news.toConfirm.push(arrived)
      }
      continue
    }

    // Dropped by this player: the partner's code says what they decided.
    if (mine === undefined || mine.state !== 'pending') continue
    if (theirs.state === 'confirmed') {
      const confirmed: Pin = { ...mine, state: 'confirmed' }
      next = withPin(next, confirmed)
      news.confirmed.push(confirmed)
    } else if (theirs.state === 'declined') {
      const declined: Pin = { ...mine, state: 'declined' }
      next = withPin(next, declined)
      news.declined.push(declined)
    }
  }

  return { save: next, news }
}
