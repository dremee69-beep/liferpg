// DRAWS THE APP ICONS (the ones on the phone's home screen)
// Run with:  npm run icons
//
// The icon is original art described right here with shapes and numbers: a
// little house with a dark outline and a hard "sticker" shadow, on a lilac
// background, matching the look of the app. This script paints it at the
// sizes phones need and writes PNG image files into the public folder.
// No drawing program or download needed.
//
// All positions are fractions of the icon: 0 is the left/top edge, 1 is the
// right/bottom edge. The art stays in the middle because phones crop the
// edges of icons into circles or rounded squares.

import { mkdirSync, writeFileSync } from 'node:fs'
import { makePng } from './png.mjs'

// Colours as [red, green, blue], each from 0 to 255. Same as the app's.
const LILAC = [207, 196, 247] // background
const INK = [30, 27, 46] // outline and shadow
const CORAL = [255, 159, 142] // roof
const WHITE = [255, 255, 255] // wall
const BUTTER = [255, 209, 102] // door

const LINE = 0.024 // how thick the outline is
const SHADOW = 0.035 // how far the shadow sits down and to the right

// The shapes, each a list of corner points going round the shape.
const ROOF = [
  [0.5, 0.2],
  [0.79, 0.46],
  [0.21, 0.46],
]
const WALL = [
  [0.29, 0.46],
  [0.71, 0.46],
  [0.71, 0.75],
  [0.29, 0.75],
]
const DOOR = [
  [0.44, 0.57],
  [0.56, 0.57],
  [0.56, 0.75],
  [0.44, 0.75],
]

// Is the point (x, y) inside the shape?
function inside(shape, x, y) {
  let result = false
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, yi] = shape[i]
    const [xj, yj] = shape[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      result = !result
    }
  }
  return result
}

// How far the point (x, y) is from the edge of the shape.
function distanceToEdge(shape, x, y) {
  let best = Infinity
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [ax, ay] = shape[j]
    const [bx, by] = shape[i]
    const dx = bx - ax
    const dy = by - ay
    // How far along the edge the nearest point is, kept between its ends.
    const along = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)),
    )
    best = Math.min(best, Math.hypot(x - (ax + along * dx), y - (ay + along * dy)))
  }
  return best
}

// Is the point inside the shape, or within `grow` of its edge?
// (This is how outlines are made: a slightly bigger, dark copy underneath.)
function insideGrown(shape, x, y, grow) {
  return inside(shape, x, y) || distanceToEdge(shape, x, y) < grow
}

// Is the point inside the house outline (roof or wall, grown by the line)?
function inHouse(x, y) {
  return insideGrown(ROOF, x, y, LINE) || insideGrown(WALL, x, y, LINE)
}

// The colour of the icon at one point. Later lines are painted on top.
function colourAt(x, y) {
  let colour = LILAC
  if (inHouse(x - SHADOW, y - SHADOW)) colour = INK // the shadow
  if (inHouse(x, y)) colour = INK // the outline
  if (inside(WALL, x, y)) colour = WHITE
  if (inside(ROOF, x, y)) colour = CORAL
  // The line where the roof meets the wall.
  if (Math.abs(y - 0.46) < LINE / 2 && x > 0.21 && x < 0.79) colour = INK
  if (insideGrown(DOOR, x, y, LINE / 2) && y < 0.75) colour = INK
  if (inside(DOOR, x, y) && distanceToEdge(DOOR, x, y) > LINE / 2) colour = BUTTER
  return colour
}

// Builds a square image of the given size. Each pixel is the average of a
// few points inside it, which keeps slanted edges smooth instead of jagged.
function makeIcon(size) {
  const SAMPLES = 4 // 4 x 4 points per pixel
  return makePng(size, size, (px, py) => {
    const total = [0, 0, 0]
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const colour = colourAt(
          (px + (sx + 0.5) / SAMPLES) / size,
          (py + (sy + 0.5) / SAMPLES) / size,
        )
        total[0] += colour[0]
        total[1] += colour[1]
        total[2] += colour[2]
      }
    }
    return total.map((sum) => Math.round(sum / (SAMPLES * SAMPLES)))
  })
}

const FILES = [
  ['public/icon-192.png', 192], // Android home screen
  ['public/icon-512.png', 512], // Android splash screen and app stores
  ['public/apple-touch-icon.png', 180], // iPhone home screen
  ['public/favicon.png', 48], // browser tab
]

mkdirSync('public', { recursive: true })
for (const [path, size] of FILES) {
  writeFileSync(path, makeIcon(size))
  console.log(`wrote ${path} (${size} x ${size})`)
}
