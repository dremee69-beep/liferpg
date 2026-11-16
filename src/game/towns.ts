// TOWN LABELS
// Choosing which town names to show on the map, and where each one goes.
//
// There are thousands of towns, far too many to show at once. So for the
// part of the map on screen, the app takes the most important towns in
// view (up to TOWN_LABEL_CANDIDATES of them) and goes down that list from
// the top, keeping a town only if its label would not sit on top of one
// already kept. Zoomed out, that leaves just the big cities; zoomed in,
// there is room for the small towns too.

import {
  TOWN_DOT_GAP,
  TOWN_DOT_MARGIN,
  TOWN_LABEL_CANDIDATES,
  TOWN_LABEL_LETTER_WIDTH,
  TOWN_LABEL_LINE_HEIGHT,
  TOWN_LABEL_SIZE,
} from './rules.ts'
import type { Town } from '../map/towns.ts'

// The part of the map on screen, on the map's own grid.
export type MapView = { left: number; top: number; width: number; height: number }

// Where the name sits compared with the town's dot. Tried in this order.
export const LABEL_SIDES = ['right', 'left', 'above', 'below'] as const
export type LabelSide = (typeof LABEL_SIDES)[number]

export type TownLabel = {
  name: string
  x: number // where the town's dot goes
  y: number
  side: LabelSide
  // Where the middle of the name goes (left to right, and top to bottom).
  textX: number
  textY: number
}

// A rectangle on the grid.
export type LabelBox = { x1: number; y1: number; x2: number; y2: number }

// How tall the letters are, in grid units, for this view. Tied to the
// view's width so the names look the same size on screen at every zoom.
export function townLabelSize(view: MapView): number {
  return view.width * TOWN_LABEL_SIZE
}

// Where a town's name goes for the given side, and the space the name and
// the dot take up together.
export function placeTownLabel(
  town: { name: string; x: number; y: number },
  side: LabelSide,
  view: MapView,
): { textX: number; textY: number; box: LabelBox } {
  const size = townLabelSize(view)
  const gap = size * TOWN_DOT_GAP
  const margin = size * TOWN_DOT_MARGIN
  const width = town.name.length * size * TOWN_LABEL_LETTER_WIDTH
  const line = size * TOWN_LABEL_LINE_HEIGHT

  // The middle of the name.
  let textX = town.x
  let textY = town.y
  if (side === 'right') textX = town.x + gap + width / 2
  if (side === 'left') textX = town.x - gap - width / 2
  if (side === 'above') textY = town.y - gap - line / 2
  if (side === 'below') textY = town.y + gap + line / 2

  // The box round the name, stretched to take in the dot as well.
  const box = {
    x1: Math.min(textX - width / 2, town.x - margin),
    x2: Math.max(textX + width / 2, town.x + margin),
    y1: Math.min(textY - line / 2, town.y - margin),
    y2: Math.max(textY + line / 2, town.y + margin),
  }
  return { textX, textY, box }
}

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1
}

// The town labels to show for a view. `towns` must run from the most
// important town to the least (INDIA_TOWNS does).
export function townLabelsFor(towns: readonly Town[], view: MapView): TownLabel[] {
  const right = view.left + view.width
  const bottom = view.top + view.height

  // The most important towns on screen, most important first.
  const candidates: { name: string; x: number; y: number }[] = []
  for (const [name, x, y] of towns) {
    if (x < view.left || x > right || y < view.top || y > bottom) continue
    candidates.push({ name, x, y })
    if (candidates.length === TOWN_LABEL_CANDIDATES) break
  }

  // The first (so the most important) town still waiting for a label that
  // this box would cover, as its place in the list. If the box covers none,
  // the answer is the length of the list. Towns right on top of this town's
  // own dot are not counted: they are hidden whichever side the name goes.
  const margin = townLabelSize(view) * TOWN_DOT_MARGIN
  function firstTownHiddenBy(
    box: LabelBox,
    town: { x: number; y: number },
    from: number,
  ): number {
    for (let i = from; i < candidates.length; i++) {
      const { x, y } = candidates[i]
      if (Math.abs(x - town.x) < margin && Math.abs(y - town.y) < margin) continue
      if (x > box.x1 && x < box.x2 && y > box.y1 && y < box.y2) return i
    }
    return candidates.length
  }

  const taken: LabelBox[] = []
  const labels: TownLabel[] = []

  candidates.forEach((town, index) => {
    // Try the name on each side of the dot. A side is no good if the name
    // would run off the screen or sit on a label already kept. Of the sides
    // that fit, use the one that leaves the important towns nearby showing:
    // the side where the first town it hides is furthest down the list (the
    // earliest in LABEL_SIDES when they are equal).
    let best: { label: TownLabel; box: LabelBox; firstHidden: number } | null = null
    for (const side of LABEL_SIDES) {
      const { textX, textY, box } = placeTownLabel(town, side, view)
      if (box.x1 < view.left || box.x2 > right) continue
      if (box.y1 < view.top || box.y2 > bottom) continue
      if (taken.some((other) => boxesOverlap(box, other))) continue
      const firstHidden = firstTownHiddenBy(box, town, index + 1)
      if (best === null || firstHidden > best.firstHidden) {
        best = { label: { ...town, side, textX, textY }, box, firstHidden }
      }
    }
    if (best === null) return
    taken.push(best.box)
    labels.push(best.label)
  })
  return labels
}
