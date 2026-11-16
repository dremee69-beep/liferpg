// GAME RULES
// Every number the game uses lives in this one file, so it is easy to tweak.
// The source of truth for these values is the LifeRPG rulebook.

// XP you earn when you log an action.
export const XP_SMALL = 10 // e.g. a 20-minute read
export const XP_BIG = 25 // e.g. a full workout

// A daily quest is worth one of these two amounts. Each daily has its own
// size, chosen when it is added or edited. They match the Small and Big
// buttons, so a demanding daily can pay as much as a big action.
export const DAILY_XP_CHOICES = [
  { xp: XP_SMALL, name: 'Small' },
  { xp: XP_BIG, name: 'Big' },
] as const

// Is this number one of the allowed daily sizes?
export function isDailyXp(value: unknown): value is number {
  return DAILY_XP_CHOICES.some((choice) => choice.xp === value)
}

// Each realm keeps between 1 and this many daily quests.
export const MAX_DAILIES_PER_REALM = 3

// The longest name a daily quest can have, in letters.
export const MAX_DAILY_NAME_LENGTH = 60

// CHALLENGES: chains of tiers with a weekly target. Finishing a tier pays
// this reward (in the challenge's realm) and unlocks the next tier.
export const TIER_REWARD_XP = 50
export const TIER_REWARD_SKILL_POINTS = 1

// Sensible limits for what can be typed into a challenge.
export const MAX_CHALLENGES = 12
export const MAX_TIERS = 10
export const MAX_TIER_WEEKS = 12
export const MAX_CHALLENGE_NAME_LENGTH = 40

// The ready-made example from the rulebook: Health, "Movement".
export const EXAMPLE_CHALLENGE = {
  realm: 'health',
  name: 'Movement',
  tiers: [
    { name: 'Getting Moving', daysPerWeek: 3, weeks: 2 },
    { name: 'Habit Forming', daysPerWeek: 4, weeks: 3 },
    { name: 'Unstoppable', daysPerWeek: 5, weeks: 4 },
  ],
} as const

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

// The daily quests every new save starts with: one per realm, taken from the
// rulebook. They are copied into the save, so each player can change their own
// list later without touching this file.
export const DEFAULT_DAILIES = [
  {
    id: 'daily-health-1',
    realm: 'health',
    name: 'Did a workout today',
    xp: XP_SMALL,
  },
  {
    id: 'daily-mind-1',
    realm: 'mind',
    name: 'Read for 20 minutes',
    xp: XP_SMALL,
  },
  {
    id: 'daily-wealth-1',
    realm: 'wealth',
    name: "Logged today's spending",
    xp: XP_SMALL,
  },
  {
    id: 'daily-together-1',
    realm: 'together',
    name: '30 minutes of phone-free time together',
    xp: XP_SMALL,
  },
  {
    id: 'daily-questAbroad-1',
    realm: 'questAbroad',
    name: '1 hour of application work',
    xp: XP_SMALL,
  },
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
