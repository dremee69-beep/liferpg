// MAP PINS
// A pin marks a place the two of you visited together. The Map screen works
// out where it is, how high and what terrain (see geo.ts and
// src/map/heights.ts); this file keeps the list of pins in the save.
//
// For now a pin belongs to the player who dropped it and waits to be shared.
// Sending it to your partner and confirming it come in a later update.
//
// Like the other game files, nothing here changes the save it is given: each
// function hands back a fresh copy, or the very same save when nothing changed.

import { dayKey } from './dates.ts'
import type { TerrainId } from './geo.ts'
import { MAX_PIN_NAME_LENGTH, MAX_PINS } from './rules.ts'
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
  }
  return { ...save, pins: [...save.pins, pin] }
}

// Change a pin's name, date or bucket-list tick. Where it is cannot be
// changed: to move a pin, remove it and drop it again.
export function updatePin(
  save: SaveData,
  pinId: string,
  changes: { name: string; date: string; bucketList: boolean },
  now: Date,
): SaveData {
  const old = save.pins.find((pin) => pin.id === pinId)
  const name = cleanPinName(changes.name)
  if (old === undefined || name === null || !isVisitDate(changes.date, now)) {
    return save
  }
  if (
    old.name === name &&
    old.date === changes.date &&
    old.bucketList === changes.bucketList
  ) {
    return save // nothing is different
  }
  const updated: Pin = { ...old, name, date: changes.date, bucketList: changes.bucketList }
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
