// SHRINKING A PHOTO for a map pin.
// A phone photo is several megabytes: far too big to keep 200 of them in the
// save. This cuts the middle square out of the photo, shrinks it to
// PIN_PHOTO_SIZE pixels across (128), and saves it as a JPEG of about 10 KB,
// written out as text (a "data URL") so it can sit inside the save.
//
// It runs in the browser only: it uses an <img> to read the photo and a
// <canvas> (a drawing surface) to shrink it.

import { isPinPhoto } from '../game/markers.ts'
import { PIN_PHOTO_SIZE } from '../game/rules.ts'

// Loads the photo file into an <img>. Browsers turn the photo the right way
// up by themselves (phones store "rotate me" as a note inside the file).
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const address = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(address)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(address)
      reject(new Error('not a picture this browser can read'))
    }
    image.src = address
  })
}

// Returns the small photo, or null if the file could not be used.
export async function shrinkPhoto(file: File): Promise<string | null> {
  let image: HTMLImageElement
  try {
    image = await loadImage(file)
  } catch {
    return null
  }

  // The biggest square in the middle of the photo.
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  if (side === 0) return null
  const left = (image.naturalWidth - side) / 2
  const top = (image.naturalHeight - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = PIN_PHOTO_SIZE
  canvas.height = PIN_PHOTO_SIZE
  const context = canvas.getContext('2d')
  if (context === null) return null
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, left, top, side, side, 0, 0, PIN_PHOTO_SIZE, PIN_PHOTO_SIZE)

  // Try good quality first; if that is unusually big, try a smaller file.
  for (const quality of [0.8, 0.6, 0.4]) {
    const photo = canvas.toDataURL('image/jpeg', quality)
    if (isPinPhoto(photo)) return photo
  }
  return null
}
