// TESTS for the XP and level maths.
// Run them with:  npm test
// Each test() is one small check. If the maths ever breaks, a check fails.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  levelForXp,
  levelProgress,
  playerLevel,
  totalXpForLevel,
} from '../src/game/xp.ts'

test('total XP needed matches the rulebook table', () => {
  assert.equal(totalXpForLevel(1), 0)
  assert.equal(totalXpForLevel(2), 100)
  assert.equal(totalXpForLevel(3), 300)
  assert.equal(totalXpForLevel(4), 600)
  assert.equal(totalXpForLevel(5), 1000)
  assert.equal(totalXpForLevel(10), 4500)
})

test('a realm starts at level 1', () => {
  assert.equal(levelForXp(0), 1)
})

test('you level up exactly when you reach the needed XP', () => {
  assert.equal(levelForXp(99), 1)
  assert.equal(levelForXp(100), 2)
  assert.equal(levelForXp(299), 2)
  assert.equal(levelForXp(300), 3)
  assert.equal(levelForXp(1000), 5)
  assert.equal(levelForXp(4500), 10)
})

test('the XP bar shows progress inside the current level', () => {
  // 150 XP = level 2 (which began at 100), so 50 of the 200 needed for level 3.
  assert.deepEqual(levelProgress(150), {
    level: 2,
    xpIntoLevel: 50,
    xpForThisLevel: 200,
  })
  // A brand new realm: empty bar, 100 to go.
  assert.deepEqual(levelProgress(0), {
    level: 1,
    xpIntoLevel: 0,
    xpForThisLevel: 100,
  })
})

test('player level is the sum of realm levels minus 4', () => {
  const fresh = { health: 0, mind: 0, wealth: 0, together: 0, questAbroad: 0 }
  assert.equal(playerLevel(fresh), 1)

  // Health at level 3 (+2) and Mind at level 2 (+1) -> player level 4.
  const some = { health: 300, mind: 100, wealth: 0, together: 0, questAbroad: 0 }
  assert.equal(playerLevel(some), 4)
})
