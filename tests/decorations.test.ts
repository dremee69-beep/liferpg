// TESTS for the map's decorations: each one must sit in a sensible place.
// Run them with:  npm test
//
// The places are famous landmarks and regions, not anyone's travel history.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lonLatToGrid, stateAt } from '../src/game/geo.ts'
import { LANDMARKS, MOVING, NATURE } from '../src/map/decorations.ts'
import { INDIA_MAP } from '../src/map/india.ts'

const ALL = [...NATURE, ...LANDMARKS, ...MOVING]

test('every decoration is on the map', () => {
  for (const decoration of ALL) {
    const [x, y] = lonLatToGrid(decoration.lon, decoration.lat)
    assert.ok(
      x > 0 && x < INDIA_MAP.width && y > 0 && y < INDIA_MAP.height,
      `${decoration.kind} at ${decoration.lon}, ${decoration.lat} is off the map`,
    )
  }
})

test('every landmark is inside its own state', () => {
  for (const landmark of LANDMARKS) {
    const state = stateAt(lonLatToGrid(landmark.lon, landmark.lat))
    assert.equal(state?.name, landmark.state, `${landmark.name} is in the wrong place`)
  }
})

test('trees, mountains, palms and dunes are inside India', () => {
  for (const item of NATURE) {
    const state = stateAt(lonLatToGrid(item.lon, item.lat))
    assert.notEqual(state, null, `${item.kind} at ${item.lon}, ${item.lat} is outside India`)
  }
})

test('clouds, waves and boats are out at sea; birds are over India', () => {
  for (const item of MOVING) {
    const state = stateAt(lonLatToGrid(item.lon, item.lat))
    if (item.kind === 'birds') {
      assert.notEqual(state, null, `birds at ${item.lon}, ${item.lat} are outside India`)
    } else {
      assert.equal(state, null, `${item.kind} at ${item.lon}, ${item.lat} is on land`)
    }
  }
})
