// EPIC QUESTS
// An epic quest is a long goal in one realm, broken into milestones. The
// player ticks a milestone when it is really done, and each tick pays XP.
//
// Like the other game files, nothing here changes the save it is given: each
// function hands back a fresh copy, or the very same save when nothing changed.

import {
  EPIC_MILESTONE_XP,
  MAX_EPIC_NAME_LENGTH,
  MAX_EPICS,
  MAX_MILESTONE_NAME_LENGTH,
  MAX_MILESTONES,
} from './rules.ts'
import type { RealmId } from './rules.ts'
import type { EpicQuest, Milestone, SaveData } from '../storage/save.ts'

// What the player fills in to create an epic quest.
export type EpicInput = {
  realm: RealmId
  name: string
  milestones: string[] // the milestone names, in order
}

// ---------------------------------------------------------------------------
// Tidying what was typed
// ---------------------------------------------------------------------------

// Tidies a typed epic name. Returns null when nothing is left.
export function cleanEpicName(typed: string): string | null {
  const name = typed.trim().slice(0, MAX_EPIC_NAME_LENGTH).trim()
  return name === '' ? null : name
}

// Tidies a list of typed milestone names: trims each one and drops the
// empty ones (so blank lines in the form do no harm).
export function cleanMilestoneNames(typed: string[]): string[] {
  return typed
    .map((name) => name.trim().slice(0, MAX_MILESTONE_NAME_LENGTH).trim())
    .filter((name) => name !== '')
}

// Builds fresh, not-yet-done milestones with ids nothing else in the epic
// is using. `taken` is the milestones the epic already has.
function newMilestones(
  epicId: string,
  names: string[],
  taken: Milestone[],
): Milestone[] {
  const used = new Set(taken.map((milestone) => milestone.id))
  let number = 0
  return names.map((name) => {
    let id: string
    do {
      number += 1
      id = `${epicId}-m${number}`
    } while (used.has(id))
    used.add(id)
    return { id, name, doneAt: null }
  })
}

// ---------------------------------------------------------------------------
// Adding, changing and removing
// ---------------------------------------------------------------------------

export function canAddEpic(save: SaveData): boolean {
  return save.epics.length < MAX_EPICS
}

// Add an epic quest. Needs a name and at least one milestone.
export function addEpic(save: SaveData, input: EpicInput, now: Date): SaveData {
  const name = cleanEpicName(input.name)
  const names = cleanMilestoneNames(input.milestones)
  if (name === null || names.length === 0 || names.length > MAX_MILESTONES) {
    return save
  }
  if (!canAddEpic(save)) return save

  // Build an id nothing else is using.
  let id = `epic-${input.realm}-${now.getTime().toString(36)}`
  while (save.epics.some((epic) => epic.id === id)) id = `${id}x`

  const epic: EpicQuest = {
    id,
    realm: input.realm,
    name,
    milestones: newMilestones(id, names, []),
  }
  return { ...save, epics: [...save.epics, epic] }
}

// Change an epic's name and its milestones that are still to do.
// Milestones already ticked are locked: they are always kept as they are
// (and listed first). `openMilestones` replaces every milestone not yet done.
export function updateEpic(
  save: SaveData,
  epicId: string,
  changes: { name: string; openMilestones: string[] },
): SaveData {
  const old = save.epics.find((epic) => epic.id === epicId)
  if (old === undefined) return save

  const name = cleanEpicName(changes.name)
  if (name === null) return save

  const done = old.milestones.filter((milestone) => milestone.doneAt !== null)
  const names = cleanMilestoneNames(changes.openMilestones)
  const total = done.length + names.length
  if (total === 0 || total > MAX_MILESTONES) return save

  const updated: EpicQuest = {
    ...old,
    name,
    milestones: [...done, ...newMilestones(old.id, names, done)],
  }
  return {
    ...save,
    epics: save.epics.map((epic) => (epic.id === epicId ? updated : epic)),
  }
}

// Remove an epic quest. XP it already earned is kept, and so is its history.
export function removeEpic(save: SaveData, epicId: string): SaveData {
  if (!save.epics.some((epic) => epic.id === epicId)) return save
  return { ...save, epics: save.epics.filter((epic) => epic.id !== epicId) }
}

// ---------------------------------------------------------------------------
// Ticking and unticking
// ---------------------------------------------------------------------------

// Tick a milestone: pays the XP in the epic's realm, writes a line in the
// log, and adds a line to the history. Milestones can be ticked in any order.
// Does nothing if the milestone does not exist or is already done.
export function completeMilestone(
  save: SaveData,
  epicId: string,
  milestoneId: string,
  now: Date,
): SaveData {
  const epic = save.epics.find((e) => e.id === epicId)
  const milestone = epic?.milestones.find((m) => m.id === milestoneId)
  if (epic === undefined || milestone === undefined) return save
  if (milestone.doneAt !== null) return save

  const at = now.toISOString()
  return {
    ...save,
    realmXp: {
      ...save.realmXp,
      [epic.realm]: save.realmXp[epic.realm] + EPIC_MILESTONE_XP,
    },
    log: [...save.log, { realm: epic.realm, xp: EPIC_MILESTONE_XP, at, milestoneId }],
    epics: save.epics.map((e) =>
      e.id !== epicId
        ? e
        : {
            ...e,
            milestones: e.milestones.map((m) =>
              m.id === milestoneId ? { ...m, doneAt: at } : m,
            ),
          },
    ),
    finishedMilestones: [
      ...save.finishedMilestones,
      {
        milestoneId,
        epicName: epic.name,
        milestoneName: milestone.name,
        realm: epic.realm,
        at,
      },
    ],
  }
}

// Untick a milestone and drop its line from the history. This is used when
// its log entry is removed or undone; the XP is taken back there.
export function untickMilestone(save: SaveData, milestoneId: string): SaveData {
  return {
    ...save,
    epics: save.epics.map((epic) =>
      epic.milestones.some((m) => m.id === milestoneId)
        ? {
            ...epic,
            milestones: epic.milestones.map((m) =>
              m.id === milestoneId ? { ...m, doneAt: null } : m,
            ),
          }
        : epic,
    ),
    finishedMilestones: save.finishedMilestones.filter(
      (line) => line.milestoneId !== milestoneId,
    ),
  }
}

// ---------------------------------------------------------------------------
// What the screens show
// ---------------------------------------------------------------------------

export type EpicView = {
  id: string
  realm: RealmId
  name: string
  milestones: Milestone[]
  doneCount: number
  total: number
  allDone: boolean
}

// Everything a screen needs to draw one epic quest.
export function epicView(epic: EpicQuest): EpicView {
  const doneCount = epic.milestones.filter((m) => m.doneAt !== null).length
  return {
    id: epic.id,
    realm: epic.realm,
    name: epic.name,
    milestones: epic.milestones,
    doneCount,
    total: epic.milestones.length,
    allDone: doneCount === epic.milestones.length,
  }
}
