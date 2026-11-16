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

// SHIELDS: a missed challenge week uses one shield by itself, and the week
// then counts as done. Every week finished on target earns one back.
export const SHIELDS_AT_START = 1 // what a new player begins with
export const MAX_SHIELDS = 2 // the most a player can hold

// EPIC QUESTS: goals that run for months, broken into milestones. Ticking a
// milestone pays this much XP in the epic's realm.
export const EPIC_MILESTONE_XP = 100

// PARTY QUESTS: things you do as a pair. Either player logs one; it pays
// this much Together XP to each of you once the other confirms it.
export const PARTY_QUEST_XP = 25

// The party quests every save starts with. Each player can change their own
// list later without touching this file.
export const DEFAULT_PARTY_QUESTS = [
  { id: 'party-1', name: 'Date night' },
  { id: 'party-2', name: 'Cooking together' },
  { id: 'party-3', name: 'A walk together' },
  { id: 'party-4', name: 'Weekly campfire review' },
] as const

export const MAX_PARTY_QUESTS = 8
export const MAX_PARTY_QUEST_NAME_LENGTH = 40
// How many logged party quests the save remembers, and how many of the
// newest ones travel in a share code.
export const MAX_PARTY_LOGS = 200
export const PARTY_LOGS_IN_CODE = 20

// Sensible limits for what can be typed into an epic quest.
export const MAX_EPICS = 8
export const MAX_MILESTONES = 15
export const MAX_EPIC_NAME_LENGTH = 40
export const MAX_MILESTONE_NAME_LENGTH = 60

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

// The daily quests every new save starts with: one per solo realm, taken from
// the rulebook. (Together has none: see PAIR_REALM below.) They are copied into the save, so each player can change their own
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

// TOGETHER IS THE PAIR REALM: its XP comes only from things you do as a
// pair, which means confirmed party quests. It has no Small / Big buttons
// and no solo dailies.
export const PAIR_REALM: RealmId = 'together'

export function isPairRealm(realm: RealmId): boolean {
  return realm === PAIR_REALM
}

// The realms you level on your own: every realm except the pair realm.
export const SOLO_REALMS = REALMS.filter((realm) => !isPairRealm(realm.id))
