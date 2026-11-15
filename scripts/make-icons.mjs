// DRAWS THE APP ICONS (the ones on the phone's home screen)
// Run with:  npm run icons
//
// The icon is original pixel art described right here as a 16 x 16 grid of
// letters. This script blows it up to the sizes phones need and writes PNG
// image files into the public folder. No drawing program or download needed.

import { mkdirSync, writeFileSync } from 'node:fs'
import { makePng } from './png.mjs'

// Each letter is one colour (red, green, blue from 0 to 255).
const COLOURS = {
  '.': [241, 223, 179], // background: warm parchment
  R: [181, 71, 60], // roof
  W: [255, 250, 240], // wall
  B: [63, 110, 168], // window
  D: [107, 68, 35], // door
  G: [47, 125, 91], // grass
}

// The picture: a little village house. The art stays in the middle because
// phones crop the edges of icons into circles or rounded squares.
const ART = [
  '................',
  '................',
  '................',
  '.......RR.......',
  '......RRRR......',
  '.....RRRRRR.....',
  '....RRRRRRRR....',
  '...RRRRRRRRRR...',
  '....WWWWWWWW....',
  '....WBBWWDDW....',
  '....WBBWWDDW....',
  '....WWWWWDDW....',
  '...GGGGGGGGGG...',
  '................',
  '................',
  '................',
]

// Builds a square image of the given size from the ART grid.
function makeIcon(size) {
  const grid = ART.length
  return makePng(size, size, (x, y) => {
    // Which art cell does this pixel fall in? (This is the "blow up" step.)
    const letter = ART[Math.floor((y * grid) / size)][Math.floor((x * grid) / size)]
    return COLOURS[letter]
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
