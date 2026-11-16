// HISTORY
// Sorts everything the save remembers into days and weeks, so the History
// screen can show what you did and when. Nothing here changes the save.

import { dayKey, weekKey } from './dates.ts'
import type { LogEntry, SaveData, WeekResult } from '../storage/save.ts'

// What a log entry was, in words: the daily's name, a plain logged action,
// a tier reward, or a shield note.
export function describeEntry(entry: LogEntry, save: SaveData): string {
  if (entry.challengeId !== undefined) {
    const challenge = save.challenges.find((c) => c.id === entry.challengeId)
    // A note that a shield covered a missed week.
    if (entry.shield === true) {
      return challenge ? `Shield used: ${challenge.name}` : 'Shield used'
    }
    // Bonus XP for finishing a challenge tier.
    return challenge ? `Tier complete: ${challenge.name}` : 'Challenge tier complete'
  }
  if (entry.dailyId !== undefined) {
    const daily = save.dailies.find((d) => d.id === entry.dailyId)
    return daily?.name ?? 'Daily quest'
  }
  return 'Logged action'
}

// Is this entry something the player did (not a reward or a shield note)?
function isAction(entry: LogEntry): boolean {
  return entry.challengeId === undefined
}

// ----- by day ---------------------------------------------------------------

export type DayHistory = {
  day: string // a day key, e.g. "2026-11-16"
  xp: number // all XP earned that day, rewards included
  actions: number // things the player did that day
  entries: LogEntry[] // that day's entries, newest first
}

// Every day that has something in the log, newest day first.
export function daysHistory(save: SaveData): DayHistory[] {
  const byDay = new Map<string, DayHistory>()
  for (const entry of save.log) {
    const day = dayKey(new Date(entry.at))
    let group = byDay.get(day)
    if (group === undefined) {
      group = { day, xp: 0, actions: 0, entries: [] }
      byDay.set(day, group)
    }
    group.xp += entry.xp
    if (isAction(entry)) group.actions += 1
    group.entries.unshift(entry) // newest first
  }
  // Day keys sort correctly as plain text; b before a puts the newest first.
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1))
}

// ----- by week --------------------------------------------------------------

export type WeekHistory = {
  week: string // a week key: its Monday
  xp: number // all XP earned that week, rewards included
  actions: number // things the player did that week
  dailies: number // how many of those were daily quests
  results: WeekResult[] // how each challenge's week turned out
}

// Every week that has something in the log or a challenge result, newest
// week first.
export function weeksHistory(save: SaveData): WeekHistory[] {
  const byWeek = new Map<string, WeekHistory>()
  function groupFor(week: string): WeekHistory {
    let group = byWeek.get(week)
    if (group === undefined) {
      group = { week, xp: 0, actions: 0, dailies: 0, results: [] }
      byWeek.set(week, group)
    }
    return group
  }

  for (const entry of save.log) {
    const group = groupFor(weekKey(new Date(entry.at)))
    group.xp += entry.xp
    if (isAction(entry)) group.actions += 1
    if (entry.dailyId !== undefined) group.dailies += 1
  }
  for (const result of save.weekResults) {
    groupFor(result.week).results.push(result)
  }
  return [...byWeek.values()].sort((a, b) => (a.week < b.week ? 1 : -1))
}
