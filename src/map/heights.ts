// READING HEIGHTS IN THE APP
// public/map/india-heights.png is a picture whose red values are height
// codes (see scripts/make-map.mjs). This file loads that picture once and
// lets the Map screen ask "how high is this spot, and is the sea close?".
//
// It only works in a browser (it uses a hidden drawing surface, a "canvas",
// to read the picture's pixels), which is why it is kept apart from the
// plain maths in src/game/geo.ts.

import { metresFromCode } from '../game/geo.ts'
import type { GridPoint } from '../game/geo.ts'
import { INDIA_MAP } from './india.ts'

const HEIGHTS_URL = `${import.meta.env.BASE_URL}map/india-heights.png`

// How many grid cells around a spot count as "close" when looking for the
// sea. One cell is about 2.4 km, so 4 cells is about 10 km.
const SEA_REACH = 4

export type Heights = {
  // The height at a grid point, and whether the sea is within about 10 km.
  at: (point: GridPoint) => { metres: number; nearSea: boolean }
}

// The picture is loaded the first time it is asked for, then remembered.
let loading: Promise<Heights> | null = null

export function loadHeights(): Promise<Heights> {
  if (loading === null) {
    loading = readPicture().catch((error: unknown) => {
      loading = null // let the next try start again
      throw error
    })
  }
  return loading
}

async function readPicture(): Promise<Heights> {
  const picture = new Image()
  picture.src = HEIGHTS_URL
  await picture.decode() // waits until the picture has arrived

  const wide = INDIA_MAP.heightsWidth
  const high = INDIA_MAP.heightsHeight
  const canvas = document.createElement('canvas')
  canvas.width = wide
  canvas.height = high
  const pen = canvas.getContext('2d', { willReadFrequently: true })
  if (pen === null) throw new Error('This browser cannot read the height picture.')
  pen.drawImage(picture, 0, 0, wide, high)
  // Four numbers per pixel: red, green, blue, see-through. Red is the code.
  const pixels = pen.getImageData(0, 0, wide, high).data

  function codeAt(cellX: number, cellY: number): number {
    const x = Math.min(wide - 1, Math.max(0, cellX))
    const y = Math.min(high - 1, Math.max(0, cellY))
    return pixels[(y * wide + x) * 4]
  }

  return {
    at([x, y]) {
      // From the map's grid to the height grid.
      const cellX = Math.floor((x / INDIA_MAP.width) * wide)
      const cellY = Math.floor((y / INDIA_MAP.height) * high)

      let nearSea = false
      for (let dy = -SEA_REACH; dy <= SEA_REACH && !nearSea; dy++) {
        for (let dx = -SEA_REACH; dx <= SEA_REACH; dx++) {
          if (codeAt(cellX + dx, cellY + dy) === 0) {
            nearSea = true
            break
          }
        }
      }
      return { metres: metresFromCode(codeAt(cellX, cellY)), nearSea }
    },
  }
}
