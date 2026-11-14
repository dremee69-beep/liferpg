// GAME RULES
// Every number the game uses lives in this one file, so it is easy to tweak.
// The source of truth for these values is the LifeRPG rulebook.

// XP you earn when you log an action.
export const XP_SMALL = 10 // e.g. a 20-minute read
export const XP_BIG = 25 // e.g. a full workout

// Each realm level needs this much MORE XP than the level before it.
// Level 1 -> 2 costs 100, level 2 -> 3 costs 200, and so on.
export const XP_STEP_PER_LEVEL = 100

// The five realms. `id` is the short name used inside the code and the save
// file (never change an id once people have saves). `name` is what is shown.
export const REALMS = [
  { id: 'health', name: 'Health', covers: 'Exercise and rest' },
  { id: 'mind', name: 'Mind', covers: 'Learning and reading' },
  { id: 'wealth', name: 'Wealth', covers: 'Simple money habits' },
  { id: 'together', name: 'Together', covers: 'Shared time and travel' },
  { id: 'questAbroad', name: 'Quest Abroad', covers: 'Career and life goals' },
] as const

// The two players. You pick one the first time you open the app on a phone.
export const PLAYERS = [
  { id: 'rachit', name: 'Rachit' },
  { id: 'deepika', name: 'Deepika' },
] as const

// A PlayerId is one of: 'rachit' | 'deepika'
export type PlayerId = (typeof PLAYERS)[number]['id']

// A RealmId is one of: 'health' | 'mind' | 'wealth' | 'together' | 'questAbroad'
export type RealmId = (typeof REALMS)[number]['id']
