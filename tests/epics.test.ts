// TESTS for epic quests: adding, ticking milestones, editing and saving.
// Run them with:  npm test
//
// The epic used here is made up for the tests ("Learn the guitar").

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { logAction, removeLogEntry, undoLastAction } from '../src/game/actions.ts'
import {
  addEpic,
  canAddEpic,
  cleanMilestoneNames,
  completeMilestone,
  epicView,
  removeEpic,
  updateEpic,
} from '../src/game/epics.ts'
import { describeEntry } from '../src/game/history.ts'
import {
  EPIC_MILESTONE_XP,
  MAX_EPICS,
  MAX_MILESTONES,
} from '../src/game/rules.ts'
import { newSave, parseSave, saveToText, SAVE_VERSION } from '../src/storage/save.ts'
import type { SaveData } from '../src/storage/save.ts'

// A date in November 2026 (month 10, because months count from 0).
function nov(day: number, hour = 9): Date {
  return new Date(2026, 10, day, hour, 0)
}

// A fresh save with one Mind epic of three milestones.
function startEpic(): SaveData {
  return addEpic(
    newSave('rachit'),
    {
      realm: 'mind',
      name: 'Learn the guitar',
      milestones: ['Buy a guitar', 'Learn five chords', 'Play a whole song'],
    },
    nov(9),
  )
}

// Tick the milestone at the given position (0 is the first).
function tick(save: SaveData, position: number, now: Date): SaveData {
  const epic = save.epics[0]
  return completeMilestone(save, epic.id, epic.milestones[position].id, now)
}

// ----- the numbers ---------------------------------------------------------

test('a milestone is worth 100 XP', () => {
  assert.equal(EPIC_MILESTONE_XP, 100)
})

// ----- adding --------------------------------------------------------------

test('a new epic starts with every milestone still to do', () => {
  const save = startEpic()
  const epic = save.epics[0]
  assert.equal(epic.name, 'Learn the guitar')
  assert.equal(epic.realm, 'mind')
  assert.deepEqual(
    epic.milestones.map((m) => [m.name, m.doneAt]),
    [
      ['Buy a guitar', null],
      ['Learn five chords', null],
      ['Play a whole song', null],
    ],
  )
  // Every milestone has an id of its own.
  assert.equal(new Set(epic.milestones.map((m) => m.id)).size, 3)
})

test('blank lines and extra spaces in the milestone list are tidied away', () => {
  assert.deepEqual(cleanMilestoneNames(['  First  ', '', '   ', 'Second']), [
    'First',
    'Second',
  ])
})

test('an epic needs a name and at least one milestone', () => {
  const save = newSave('rachit')
  assert.equal(addEpic(save, { realm: 'mind', name: '  ', milestones: ['A'] }, nov(9)), save)
  assert.equal(addEpic(save, { realm: 'mind', name: 'Goal', milestones: [' '] }, nov(9)), save)
})

test('there is a limit on milestones and on epics', () => {
  const tooMany = Array.from({ length: MAX_MILESTONES + 1 }, (_, i) => `Step ${i + 1}`)
  const empty = newSave('rachit')
  assert.equal(addEpic(empty, { realm: 'mind', name: 'Goal', milestones: tooMany }, nov(9)), empty)

  let save = empty
  for (let i = 0; i < MAX_EPICS; i++) {
    save = addEpic(save, { realm: 'mind', name: `Goal ${i}`, milestones: ['A'] }, nov(9, i))
  }
  assert.equal(save.epics.length, MAX_EPICS)
  assert.equal(canAddEpic(save), false)
  assert.equal(addEpic(save, { realm: 'mind', name: 'One more', milestones: ['A'] }, nov(10)), save)
})

// ----- ticking -------------------------------------------------------------

test('ticking a milestone pays 100 XP in the epic realm and is written down', () => {
  const save = tick(startEpic(), 0, nov(12))

  assert.equal(save.realmXp.mind, 100)
  assert.equal(save.realmXp.health, 0)
  assert.equal(save.epics[0].milestones[0].doneAt, nov(12).toISOString())

  const entry = save.log[save.log.length - 1]
  assert.equal(entry.xp, 100)
  assert.equal(entry.milestoneId, save.epics[0].milestones[0].id)
  assert.equal(describeEntry(entry, save), 'Milestone: Buy a guitar')

  assert.deepEqual(save.finishedMilestones, [
    {
      milestoneId: save.epics[0].milestones[0].id,
      epicName: 'Learn the guitar',
      milestoneName: 'Buy a guitar',
      realm: 'mind',
      at: nov(12).toISOString(),
    },
  ])
})

test('milestones can be ticked in any order', () => {
  const save = tick(startEpic(), 2, nov(12))
  assert.equal(save.epics[0].milestones[2].doneAt !== null, true)
  assert.equal(save.epics[0].milestones[0].doneAt, null)
})

test('a milestone cannot be ticked twice', () => {
  const once = tick(startEpic(), 0, nov(12))
  const twice = tick(once, 0, nov(13))
  assert.equal(twice, once) // the very same save: nothing happened
  assert.equal(twice.realmXp.mind, 100)
})

test('ticking every milestone completes the epic', () => {
  let save = startEpic()
  assert.equal(epicView(save.epics[0]).allDone, false)

  save = tick(save, 0, nov(12))
  save = tick(save, 1, nov(13))
  assert.deepEqual(
    [epicView(save.epics[0]).doneCount, epicView(save.epics[0]).total],
    [2, 3],
  )

  save = tick(save, 2, nov(14))
  assert.equal(epicView(save.epics[0]).allDone, true)
  assert.equal(save.realmXp.mind, 300)
})

// ----- taking a tick back --------------------------------------------------

test('removing the log entry unticks the milestone and takes the XP back', () => {
  let save = tick(startEpic(), 0, nov(12))
  save = removeLogEntry(save, save.log.length - 1)

  assert.equal(save.realmXp.mind, 0)
  assert.equal(save.epics[0].milestones[0].doneAt, null)
  assert.deepEqual(save.finishedMilestones, [])
  assert.equal(save.log.length, 0)
})

test('undo straight after a tick unticks it too', () => {
  let save = logAction(startEpic(), 'health', 10, nov(11))
  save = tick(save, 1, nov(12))
  save = undoLastAction(save)

  assert.equal(save.epics[0].milestones[1].doneAt, null)
  assert.equal(save.realmXp.mind, 0)
  assert.equal(save.realmXp.health, 10) // the earlier action is untouched
})

// ----- editing -------------------------------------------------------------

test('editing changes the name and the milestones still to do', () => {
  let save = startEpic()
  save = updateEpic(save, save.epics[0].id, {
    name: 'Learn the piano',
    openMilestones: ['Find a teacher', 'Learn a scale'],
  })
  assert.equal(save.epics[0].name, 'Learn the piano')
  assert.deepEqual(
    save.epics[0].milestones.map((m) => m.name),
    ['Find a teacher', 'Learn a scale'],
  )
})

test('ticked milestones are locked: editing keeps them exactly as they were', () => {
  let save = tick(startEpic(), 1, nov(12)) // "Learn five chords" is done
  const done = save.epics[0].milestones[1]

  save = updateEpic(save, save.epics[0].id, {
    name: 'Learn the guitar',
    openMilestones: ['Record a video'],
  })
  const milestones = save.epics[0].milestones
  assert.deepEqual(milestones[0], done) // kept, and listed first
  assert.deepEqual(
    milestones.map((m) => m.name),
    ['Learn five chords', 'Record a video'],
  )
  // The new milestone did not reuse the finished one's id.
  assert.notEqual(milestones[1].id, done.id)
})

test('an edit that would leave no milestones, or no name, is refused', () => {
  const save = startEpic()
  const id = save.epics[0].id
  assert.equal(updateEpic(save, id, { name: 'Goal', openMilestones: [] }), save)
  assert.equal(updateEpic(save, id, { name: ' ', openMilestones: ['A'] }), save)
})

// ----- removing ------------------------------------------------------------

test('removing an epic keeps its XP and its history', () => {
  let save = tick(startEpic(), 0, nov(12))
  save = removeEpic(save, save.epics[0].id)

  assert.equal(save.epics.length, 0)
  assert.equal(save.realmXp.mind, 100)
  assert.equal(save.finishedMilestones[0].milestoneName, 'Buy a guitar')
  // The log line still reads properly.
  assert.equal(describeEntry(save.log[0], save), 'Milestone: Buy a guitar')
})

// ----- saving --------------------------------------------------------------

test('epics and their ticks survive export and import', () => {
  const save = tick(startEpic(), 0, nov(12))
  assert.deepEqual(parseSave(saveToText(save)), save)
})

test('a version 6 save is upgraded with no epics', () => {
  const old = JSON.parse(saveToText(logAction(newSave('deepika'), 'mind', 25, nov(9))))
  old.version = 6
  delete old.epics
  delete old.finishedMilestones

  const upgraded = parseSave(JSON.stringify(old))
  assert.equal(upgraded?.version, SAVE_VERSION)
  assert.deepEqual(upgraded?.epics, [])
  assert.deepEqual(upgraded?.finishedMilestones, [])
  assert.equal(upgraded?.realmXp.mind, 25)
})

test('a damaged epic is dropped without losing the rest of the save', () => {
  const damaged = JSON.parse(saveToText(startEpic()))
  damaged.epics.push({ id: 'broken', name: 'No milestones' })
  const reloaded = parseSave(JSON.stringify(damaged))
  assert.equal(reloaded?.epics.length, 1)
  assert.equal(reloaded?.epics[0].name, 'Learn the guitar')
})
