// DATES
// Small helpers for "which day is this?". Everything uses the phone's own
// local time, so a day ends at midnight where the player actually is.

// A day as text, e.g. "2026-11-14". Two moments on the same local day give
// the same text, which makes "was this done today?" a simple comparison.
export function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0') // months count from 0
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
