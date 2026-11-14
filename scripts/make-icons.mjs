// DRAWS THE APP ICONS
// Run with:  npm run icons
//
// The icon is original pixel art described right here as a 16 x 16 grid of
// letters. This script blows it up to the sizes phones need and writes PNG
// image files into the public folder. No drawing program or download needed.

import { mkdirSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

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

// --- PNG file writing (the fiddly part; no need to change it) ---------------

// A PNG file is made of labelled "chunks". This builds one chunk.
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const check = Buffer.alloc(4)
  check.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, check])
}

// Builds a square PNG of the given size from the ART grid.
function makePng(size) {
  const grid = ART.length
  // Each row of the image is: one "filter" byte (0), then 3 bytes per pixel.
  const rowBytes = 1 + size * 3
  const pixels = Buffer.alloc(rowBytes * size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Which art cell does this pixel fall in? (This is the "blow up" step.)
      const letter = ART[Math.floor((y * grid) / size)][Math.floor((x * grid) / size)]
      const [r, g, b] = COLOURS[letter]
      const at = y * rowBytes + 1 + x * 3
      pixels[at] = r
      pixels[at + 1] = g
      pixels[at + 2] = b
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0) // width
  header.writeUInt32BE(size, 4) // height
  header[8] = 8 // 8 bits per colour
  header[9] = 2 // colour type 2 = red, green, blue

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // the PNG signature
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- write the files --------------------------------------------------------

const FILES = [
  ['public/icon-192.png', 192], // Android home screen
  ['public/icon-512.png', 512], // Android splash screen and app stores
  ['public/apple-touch-icon.png', 180], // iPhone home screen
  ['public/favicon.png', 48], // browser tab
]

mkdirSync('public', { recursive: true })
for (const [path, size] of FILES) {
  writeFileSync(path, makePng(size))
  console.log(`wrote ${path} (${size} x ${size})`)
}
