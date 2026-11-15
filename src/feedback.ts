// PHONE VIBRATION
// A tiny buzz when you tick something, a longer one when you level up.
// Android phones support this. iPhones do not let web apps vibrate, so there
// this quietly does nothing.

// A pattern is milliseconds: buzz, pause, buzz, pause...
const PATTERNS = {
  tap: [12],
  levelUp: [30, 50, 30, 50, 80],
}

export function buzz(kind: keyof typeof PATTERNS): void {
  try {
    navigator.vibrate?.(PATTERNS[kind])
  } catch {
    // Not supported or not allowed here: nothing to do.
  }
}
