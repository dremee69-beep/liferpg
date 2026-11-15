// PREVIEW SHEET FOR THE PIXEL ICONS
// Run with:  node scripts/preview-icons.mjs <where-to-save.png>
//
// Paints every icon from src/art/icons.ts onto one image: big on top so the
// pixels are easy to judge, and small underneath at about the size they
// appear in the app. Nothing in the app uses this file; it is only for looking.

import { writeFileSync } from 'node:fs'
import { ICON_COLOURS, ICON_SIZE, ICONS } from '../src/art/icons.ts'
import { hexToRgb, makePng } from './png.mjs'

const outPath = process.argv[2]
if (!outPath) {
  console.error('Say where to save it: node scripts/preview-icons.mjs sheet.png')
  process.exit(1)
}

const names = Object.keys(ICONS)

// Check every icon is exactly 12 rows of 12 known letters.
for (const name of names) {
  const rows = ICONS[name]
  if (rows.length !== ICON_SIZE) throw new Error(`${name}: needs ${ICON_SIZE} rows`)
  rows.forEach((row, y) => {
    if (row.length !== ICON_SIZE) throw new Error(`${name} row ${y}: needs ${ICON_SIZE} letters`)
    for (const letter of row) {
      if (letter !== '.' && !ICON_COLOURS[letter]) {
        throw new Error(`${name} row ${y}: unknown letter "${letter}"`)
      }
    }
  })
}

const BIG = 12 // each art pixel becomes 12 x 12 image pixels
const SMALL = 2 // ...and 2 x 2 in the small row (24px icons, as in the app)
const CELL = ICON_SIZE * BIG + 32 // room for one big icon plus a margin
const PER_ROW = 4
const rowsOfIcons = Math.ceil(names.length / PER_ROW)
const BAND = CELL + ICON_SIZE * SMALL + 24 // big icon, then small icon below

const width = CELL * PER_ROW
const height = BAND * rowsOfIcons

const background = hexToRgb('#fffaf0') // the app's card colour
const colours = Object.fromEntries(
  Object.entries(ICON_COLOURS).map(([letter, hex]) => [letter, hexToRgb(hex)]),
)

// Which colour is the icon's art pixel at (px, py)? Dots show the background.
function artColour(name, px, py) {
  const letter = ICONS[name][py]?.[px]
  return letter && letter !== '.' ? colours[letter] : background
}

const png = makePng(width, height, (x, y) => {
  const column = Math.floor(x / CELL)
  const band = Math.floor(y / BAND)
  const name = names[band * PER_ROW + column]
  if (!name) return background

  const inCellX = x - column * CELL
  const inBandY = y - band * BAND

  // The big icon, centred in the top part of its cell.
  const bigX = inCellX - 16
  const bigY = inBandY - 16
  if (bigX >= 0 && bigY >= 0 && bigX < ICON_SIZE * BIG && bigY < ICON_SIZE * BIG) {
    return artColour(name, Math.floor(bigX / BIG), Math.floor(bigY / BIG))
  }

  // The small icon, centred underneath.
  const smallSize = ICON_SIZE * SMALL
  const smallX = inCellX - Math.floor((CELL - smallSize) / 2)
  const smallY = inBandY - CELL
  if (smallX >= 0 && smallY >= 0 && smallX < smallSize && smallY < smallSize) {
    return artColour(name, Math.floor(smallX / SMALL), Math.floor(smallY / SMALL))
  }

  return background
})

writeFileSync(outPath, png)
console.log(`wrote ${outPath} (${width} x ${height})`)
console.log(`order, left to right, top to bottom: ${names.join(', ')}`)
