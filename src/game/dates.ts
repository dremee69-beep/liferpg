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

// The opposite of dayKey: "2026-11-14" back into a date (at midnight).
export function dateFromDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// How many days into the week a date is: Monday is 0, Sunday is 6.
// (JavaScript counts Sunday as 0, so we shift it round.)
function daysSinceMonday(date: Date): number {
  return (date.getDay() + 6) % 7
}

// WEEKS run Monday to Sunday. A week is named by the day key of its Monday,
// e.g. "2026-11-09". Because of how the text is laid out, comparing two week
// keys with < or > tells you which week is earlier.
export function weekKey(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - daysSinceMonday(date))
  return dayKey(monday)
}

// The week `count` weeks after the given one (use -1 for the week before).
export function addWeeks(week: string, count: number): string {
  const monday = dateFromDayKey(week)
  monday.setDate(monday.getDate() + 7 * count)
  return dayKey(monday)
}

// Days left in this week, counting today: 7 on a Monday, 1 on a Sunday.
export function daysLeftInWeek(date: Date): number {
  return 7 - daysSinceMonday(date)
}
