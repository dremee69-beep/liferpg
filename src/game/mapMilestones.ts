// MAP MILESTONES: rewards for exploring together (see RULEBOOK.md).
//
//   First pin together        -> "Wanderers" title
//   3 mountain destinations   -> mountain region art on the map
//                                (+ a winter outfit, once avatars exist)
//   5 Indian states together  -> "Desi Explorers" title + explorer party quests
//   First trip abroad         -> "Globetrotters" title (with the world map)
//   A bucket-list place       -> a trophy on the Village screen
//
// Only pins BOTH of you agreed on count: "confirmed" pins (see pins.ts).
// Nothing extra is stored in the save: every milestone is worked out from
// the pins each time, so both phones agree once they have swapped codes.
//
// Like the other game files, nothing here changes the save it is given.

import { isMountainHeight } from './geo.ts'
import {
  EXPLORER_PARTY_QUESTS,
  MAX_PARTY_QUESTS,
  MOUNTAINS_FOR_UNLOCK,
  STATES_FOR_UNLOCK,
} from './rules.ts'
import type { Pin, SaveData } from '../storage/save.ts'

export type MapMilestoneId = 'firstPin' | 'mountains' | 'states' | 'abroad' | 'bucketList'

export type MapMilestone = {
  id: MapMilestoneId
  name: string // what you have to do
  reward: string // what it unlocks
  have: number // how far along you are
  need: number // how many it takes
  done: boolean
}

// Is this pin abroad? (Pins outside India arrive with the world map; their
// stateId starts with "abroad-".)
export function isAbroadPin(pin: Pin): boolean {
  return pin.stateId.startsWith('abroad-')
}

// The pins you both agreed on.
export function togetherPins(save: SaveData): Pin[] {
  return save.pins.filter((pin) => pin.state === 'confirmed')
}

// Every map milestone with how far along you are.
export function mapMilestones(save: SaveData): MapMilestone[] {
  const pins = togetherPins(save)
  const inIndia = pins.filter((pin) => !isAbroadPin(pin))
  const mountains = inIndia.filter((pin) => isMountainHeight(pin.metres)).length
  const states = new Set(inIndia.map((pin) => pin.stateId)).size
  const abroad = pins.filter(isAbroadPin).length
  const bucket = pins.filter((pin) => pin.bucketList).length

  const milestone = (
    id: MapMilestoneId,
    name: string,
    reward: string,
    have: number,
    need: number,
  ): MapMilestone => ({ id, name, reward, have: Math.min(have, need), need, done: have >= need })

  return [
    milestone('firstPin', 'First pin together', '"Wanderers" title', pins.length, 1),
    milestone(
      'mountains',
      `${MOUNTAINS_FOR_UNLOCK} mountain destinations`,
      'Mountain region art on the map, and a winter outfit for when avatars arrive',
      mountains,
      MOUNTAINS_FOR_UNLOCK,
    ),
    milestone(
      'states',
      `${STATES_FOR_UNLOCK} Indian states together`,
      '"Desi Explorers" title and a set of explorer party quests',
      states,
      STATES_FOR_UNLOCK,
    ),
    milestone('abroad', 'First trip abroad', '"Globetrotters" title', abroad, 1),
    milestone('bucketList', 'A place from your bucket list', 'A trophy on the Village screen', bucket, 1),
  ]
}

// The ids of the milestones reached.
export function reachedMilestones(save: SaveData): MapMilestoneId[] {
  return mapMilestones(save)
    .filter((m) => m.done)
    .map((m) => m.id)
}

// The milestones reached in `after` that were not reached in `before`, for
// the celebration cards.
export function newlyReached(before: SaveData, after: SaveData): MapMilestone[] {
  const had = reachedMilestones(before)
  return mapMilestones(after).filter((m) => m.done && !had.includes(m.id))
}

// The titles you have earned, best last.
export function mapTitles(save: SaveData): string[] {
  const reached = reachedMilestones(save)
  const titles: string[] = []
  if (reached.includes('firstPin')) titles.push('Wanderers')
  if (reached.includes('states')) titles.push('Desi Explorers')
  if (reached.includes('abroad')) titles.push('Globetrotters')
  return titles
}

// The bucket-list places you reached together: one trophy each.
export function bucketTrophies(save: SaveData): Pin[] {
  return togetherPins(save).filter((pin) => pin.bucketList)
}

// The explorer party quests not on your list yet (by name).
export function missingExplorerQuests(save: SaveData): string[] {
  const have = save.partyQuests.map((quest) => quest.name.toLowerCase())
  return EXPLORER_PARTY_QUESTS.filter((name) => !have.includes(name.toLowerCase()))
}

// Add the explorer party quests (unlocked by 5 states), as many as fit.
// Does nothing before the milestone, or if they are all there already.
export function addExplorerQuests(save: SaveData, now: Date): SaveData {
  if (!reachedMilestones(save).includes('states')) return save
  const room = MAX_PARTY_QUESTS - save.partyQuests.length
  const adding = missingExplorerQuests(save).slice(0, Math.max(0, room))
  if (adding.length === 0) return save
  const stamp = now.getTime().toString(36)
  const quests = adding.map((name, index) => ({ id: `party-explorer-${stamp}-${index}`, name }))
  return { ...save, partyQuests: [...save.partyQuests, ...quests] }
}
