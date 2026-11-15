// PNG FILE WRITING, shared by the icon scripts.
// Give makePng a width, a height and a function that says what colour each
// pixel is; it hands back the bytes of a PNG image file.
// This is the fiddly part of the scripts. There is no need to change it.

import { crc32, deflateSync } from 'node:zlib'

// A PNG file is made of labelled "chunks". This builds one chunk.
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const check = Buffer.alloc(4)
  check.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, check])
}

// colourAt(x, y) must return [red, green, blue], each from 0 to 255.
export function makePng(width, height, colourAt) {
  // Each row of the image is: one "filter" byte (0), then 3 bytes per pixel.
  const rowBytes = 1 + width * 3
  const pixels = Buffer.alloc(rowBytes * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colourAt(x, y)
      const at = y * rowBytes + 1 + x * 3
      pixels[at] = r
      pixels[at + 1] = g
      pixels[at + 2] = b
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // 8 bits per colour
  header[9] = 2 // colour type 2 = red, green, blue

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // the PNG signature
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Turns "#b5473c" into [181, 71, 60].
export function hexToRgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}
