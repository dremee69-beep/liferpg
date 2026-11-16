// TESTS for the town labels on the map.
// Run them with:  npm test
//
// The places used here are well-known towns, chosen only because their
// positions are easy to look up. They are not anyone's travel history.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lonLatToGrid, stateAt } from '../src/game/geo.ts'
import { placeTownLabel, townLabelSize, townLabelsFor } from '../src/game/towns.ts'
import type { MapView, TownLabel } from '../src/game/towns.ts'
import { INDIA_MAP } from '../src/map/india.ts'
import { INDIA_TOWNS } from '../src/map/towns.ts'
import type { Town } from '../src/map/towns.ts'

const WHOLE_MAP: MapView = {
  left: 0,
  top: 0,
  width: INDIA_MAP.width,
  height: INDIA_MAP.height,
}

// A view of the given width centred on a place on the Earth, in the map's
// own shape (the same as the Map screen makes).
function viewAround(lon: number, lat: number, width: number): MapView {
  const [x, y] = lonLatToGrid(lon, lat)
  const height = (width * INDIA_MAP.height) / INDIA_MAP.width
  return { left: x - width / 2, top: y - height / 2, width, height }
}

// The space a label takes up, worked out the same way the app does.
function boxOf(label: TownLabel, view: MapView) {
  return placeTownLabel(label, label.side, view).box
}

const names = (labels: TownLabel[]) => labels.map((label) => label.name)

// ----- The town list itself -----

test('the town list is a sensible size and every town is on the map', () => {
  assert.ok(INDIA_TOWNS.length > 5000)
  for (const [name, x, y] of INDIA_TOWNS) {
    assert.ok(name.length > 0)
    assert.ok(x >= 0 && x <= INDIA_MAP.width, `${name} is off the map`)
    assert.ok(y >= 0 && y <= INDIA_MAP.height, `${name} is off the map`)
  }
})

test('well-known towns are in the list, in the right place', () => {
  // [name, longitude, latitude, state]
  const expected = [
    ['Mumbai', 72.88, 19.07, 'Maharashtra'],
    ['Shimla', 77.17, 31.1, 'Himachal Pradesh'],
    ['Munnar', 77.06, 10.09, 'Kerala'],
    ['Darjeeling', 88.26, 27.04, 'West Bengal'],
    ['Jaisalmer', 70.91, 26.92, 'Rajasthan'],
  ] as const
  for (const [name, lon, lat, state] of expected) {
    const [x, y] = lonLatToGrid(lon, lat)
    // Within about 10 km (4 grid units) of where it should be.
    const town = INDIA_TOWNS.find(
      (t) => t[0] === name && Math.hypot(t[1] - x, t[2] - y) < 4,
    )
    assert.ok(town, `${name} is missing or in the wrong place`)
    assert.equal(stateAt([town[1], town[2]])?.name, state)
  }
})

// ----- Choosing which labels to show -----

test('the whole map shows the big cities and not the small towns', () => {
  const labels = names(townLabelsFor(INDIA_TOWNS, WHOLE_MAP))
  for (const city of ['Mumbai', 'Delhi', 'Kolkata', 'Chennai', 'Bengaluru', 'Ahmedabad', 'Pune']) {
    assert.ok(labels.includes(city), `${city} should show`)
  }
  assert.ok(!labels.includes('Munnar'))
  assert.ok(labels.length < 80, `${labels.length} labels is too crowded`)
})

test('zooming in brings out the small towns', () => {
  // The close-up used for placing a pin, centred near Munnar.
  const labels = names(townLabelsFor(INDIA_TOWNS, viewAround(77.06, 10.09, 60)))
  assert.ok(labels.includes('Munnar'))
  // Far-away cities are off the screen.
  assert.ok(!labels.includes('Mumbai'))
})

test('a state view shows its hill towns, not only the big cities next door', () => {
  // About what the Map screen shows for Himachal Pradesh.
  const labels = names(townLabelsFor(INDIA_TOWNS, viewAround(77.3, 31.9, 210)))
  for (const town of ['Shimla', 'Kullu', 'Manali']) {
    assert.ok(labels.includes(town), `${town} should show`)
  }
})

test('labels never overlap, at any zoom', () => {
  const views = [
    WHOLE_MAP,
    viewAround(77.2, 28.6, 300), // around Delhi
    viewAround(76.3, 10.0, 60), // the crowded Kerala coast, close up
    viewAround(88.4, 22.6, 60), // around Kolkata, close up
  ]
  for (const view of views) {
    const boxes = townLabelsFor(INDIA_TOWNS, view).map((label) => boxOf(label, view))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const overlap = a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1
        assert.ok(!overlap, 'two labels overlap')
      }
    }
  }
})

test('when two towns want the same space, the more important one wins', () => {
  const view: MapView = { left: 0, top: 0, width: 100, height: 100 }
  const towns: Town[] = [
    ['Bigtown', 50, 50],
    ['Smalltown', 51, 50], // right next to Bigtown
    ['Farville', 50, 80], // well clear of both
  ]
  assert.deepEqual(names(townLabelsFor(towns, view)), ['Bigtown', 'Farville'])
})

test('towns off the screen are left out', () => {
  const view: MapView = { left: 0, top: 0, width: 100, height: 100 }
  const towns: Town[] = [
    ['Inside', 50, 50],
    ['Outside', 150, 50],
  ]
  assert.deepEqual(names(townLabelsFor(towns, view)), ['Inside'])
})

test('a name goes on the right of its dot, unless it would run off the edge', () => {
  const view: MapView = { left: 0, top: 0, width: 100, height: 100 }
  const towns: Town[] = [
    ['Middle', 50, 20],
    ['Edge', 98, 60],
  ]
  const labels = townLabelsFor(towns, view)
  assert.equal(labels[0].side, 'right')
  assert.equal(labels[1].side, 'left')
})

test('a name moves to another side rather than hide a town waiting for a label', () => {
  const view: MapView = { left: 0, top: 0, width: 100, height: 100 }
  const towns: Town[] = [
    ['Bigtown', 50, 50],
    ['Nextdoor', 60, 50], // where Bigtown's name would go on the right
  ]
  const labels = townLabelsFor(towns, view)
  assert.deepEqual(names(labels), ['Bigtown', 'Nextdoor'])
  assert.equal(labels[0].side, 'left')
})

test('every name stays on the screen', () => {
  for (const view of [WHOLE_MAP, viewAround(77.19, 32.24, 60)]) {
    for (const label of townLabelsFor(INDIA_TOWNS, view)) {
      const box = boxOf(label, view)
      assert.ok(box.x1 >= view.left && box.x2 <= view.left + view.width)
      assert.ok(box.y1 >= view.top && box.y2 <= view.top + view.height)
    }
  }
})

test('letters stay the same size on screen at every zoom', () => {
  const wide = townLabelSize({ left: 0, top: 0, width: 1000, height: 1000 })
  const close = townLabelSize({ left: 0, top: 0, width: 100, height: 100 })
  // A view ten times narrower has letters ten times smaller on the grid,
  // which the zoom then makes ten times bigger on screen.
  assert.ok(Math.abs(wide / close - 10) < 1e-9)
})
