// SAVING AND LOADING
// This is the ONLY file that knows how progress is stored on the device.
// The rest of the app just calls loadSave() and writeSave().
//
// The save is kept in the browser's "localStorage": a small notebook the
// browser keeps for this app, on this device only. It stores text, so we turn
// the save into text (JSON) when writing and back into data when reading.

import { dayKey, weekKey } from '../game/dates.ts'
import {
  DEFAULT_DAILIES,
  DEFAULT_PARTY_QUESTS,
  isDailyXp,
  MAX_SHIELDS,
  PLAYERS,
  REALMS,
  SHIELDS_AT_START,
  XP_SMALL,
} from '../game/rules.ts'
import type { PlayerId, RealmId } from '../game/rules.ts'
import { readPartnerSummary } from '../game/share.ts'
import type { PartnerSummary } from '../game/share.ts'
import type { RealmXp } from '../game/xp.ts'

// Bump this number whenever the shape of SaveData changes, and add a step to
// migrate() below so old saves are upgraded instead of lost.
//   Version 1: player, realm XP, log.
//   Version 2: adds the player's list of daily quests.
//   Version 3: each daily quest has its own XP size (10 or 25).
//   Version 4: adds the player's challenges and their skill points.
//   Version 5: adds shields.
//   Version 6: adds the history of challenge weeks and finished tiers.
//   Version 7: adds epic quests and their finished milestones.
//   Version 8: adds what the partner's last share code said.
//   Version 9: adds party quests.
export const SAVE_VERSION = 9

// The names (keys) our data is filed under in the browser's notebook.
const SAVE_KEY = 'liferpg-save'
const BACKUP_KEY = 'liferpg-save-unreadable-backup'

// One logged action: which realm, how much XP, and when (ISO date text).
// If the action was ticking off a daily quest, dailyId says which one. That
// is how the app knows a daily is already done today.
export type LogEntry = {
  realm: RealmId
  xp: number
  at: string
  dailyId?: string
  // Set on the bonus XP paid for finishing a challenge tier. These reward
  // entries are not something the player did, so they never count as
  // activity and cannot be removed by hand.
  challengeId?: string
  // Set (together with challengeId) on the note left when a shield covered
  // a missed week. It is worth 0 XP; it is only there so you can look back.
  shield?: true
  // Set on the XP paid for ticking an epic quest's milestone. Removing the
  // entry (or undoing it) also unticks that milestone.
  milestoneId?: string
  // Set on the Together XP paid for a confirmed party quest. Both players
  // agreed on it, so the entry cannot be removed by hand.
  partyId?: string
}

// One party quest on the player's list: something you do as a pair.
export type PartyQuest = {
  id: string
  name: string
}

// One time a party quest was logged, by either player.
//   'pending'   logged, waiting for the other player to confirm;
//   'confirmed' the other player confirmed it, and the XP was paid here;
//   'declined'  the other player said no.
export type PartyLog = {
  id: string // the same on both phones, so they can match it up
  name: string // the quest's name, copied in
  by: PlayerId // who logged it
  at: string // when it was logged (ISO date text)
  state: 'pending' | 'confirmed' | 'declined'
}

// One milestone of an epic quest. `doneAt` is when it was ticked (ISO date
// text), or null while it is still to do.
export type Milestone = {
  id: string
  name: string
  doneAt: string | null
}

// An epic quest: a long goal in one realm, broken into milestones.
export type EpicQuest = {
  id: string
  realm: RealmId
  name: string
  milestones: Milestone[]
}

// One line of history: a milestone that was ticked. The names are copied
// in, so the line still reads properly if the epic is renamed or removed.
export type FinishedMilestone = {
  milestoneId: string
  epicName: string
  milestoneName: string
  realm: RealmId
  at: string // when it was ticked (ISO date text)
}

// One tier of a challenge: "do it `daysPerWeek` days a week, for `weeks` weeks".
export type ChallengeTier = {
  name: string
  daysPerWeek: number
  weeks: number
}

// A challenge: a chain of tiers in one realm, worked through in order.
export type Challenge = {
  id: string
  realm: RealmId
  name: string
  // What counts as an active day: one particular daily quest (its id), or
  // null for "anything logged in this realm".
  dailyId: string | null
  tiers: ChallengeTier[]
  // Which tier is in progress: 0 is the first. When it equals the number of
  // tiers, every tier is finished.
  tierIndex: number
  // On-target weeks already counted towards the tier in progress.
  weeksDone: number
  // The last week whose result has been recorded (a week key: its Monday).
  // The next week to look at is always the one after this.
  lastCountedWeek: string
  // The week the challenge was created in. If that first, partial week is
  // missed it is a free pass (this matters once shields exist).
  startedWeek: string
}

// How one week of a challenge turned out:
//   'onTarget' the weekly target was reached;
//   'shielded' it was missed, and a shield covered it;
//   'missed'   it was missed with no shield, so it has to be done again;
//   'free'     a missed week that cost nothing (the part-week a challenge
//              started in, or a week from before shields existed).
export type WeekOutcome = 'onTarget' | 'shielded' | 'missed' | 'free'

// One line of history: how one week of one challenge turned out. The names
// are copied in, so the line still reads properly if the challenge is later
// renamed or removed.
export type WeekResult = {
  challengeId: string
  challengeName: string
  tierName: string
  realm: RealmId
  week: string // a week key: its Monday
  outcome: WeekOutcome
}

// One line of history: a challenge tier that was finished.
export type FinishedTier = {
  challengeId: string
  challengeName: string
  tierName: string
  realm: RealmId
  at: string // when it was finished (ISO date text)
}

// One daily quest: a repeatable action that can be ticked once a day.
// `xp` is what ticking it is worth: 10 (small) or 25 (big).
export type Daily = {
  id: string
  realm: RealmId
  name: string
  xp: number
}

// Everything we remember about one player on this device.
export type SaveData = {
  version: number
  player: PlayerId
  realmXp: RealmXp
  log: LogEntry[]
  dailies: Daily[]
  challenges: Challenge[]
  // Skill points earned in each realm (one per finished challenge tier).
  // They will be spent in the skill trees and reward shop later.
  skillPoints: RealmXp
  // How many shields the player holds right now (0 to MAX_SHIELDS).
  shields: number
  // Shields only look after weeks from this one on (a week key: its Monday).
  // Empty text means "every week". Saves that were upgraded get the week of
  // the upgrade here, so weeks missed before shields existed cost nothing.
  shieldsFrom: string
  // HISTORY, oldest first. These are only for looking back: the game never
  // reads them to decide anything.
  weekResults: WeekResult[]
  finishedTiers: FinishedTier[]
  finishedMilestones: FinishedMilestone[]
  // The player's epic quests.
  epics: EpicQuest[]
  // What the partner's most recent share code said, or null if no code has
  // been pasted in yet.
  partner: PartnerSummary | null
  // The player's list of party quests, and every time one was logged (by
  // either player), oldest first.
  partyQuests: PartyQuest[]
  partyLogs: PartyLog[]
}

// A fresh copy of the starting party quests.
function defaultPartyQuests(): PartyQuest[] {
  return DEFAULT_PARTY_QUESTS.map((quest) => ({ ...quest }))
}

// Every realm at zero: used for fresh XP and fresh skill points.
function zeroPerRealm(): RealmXp {
  return { health: 0, mind: 0, wealth: 0, together: 0, questAbroad: 0 }
}

// A fresh copy of the starting daily quests.
function defaultDailies(): Daily[] {
  return DEFAULT_DAILIES.map((daily) => ({ ...daily }))
}

// The two things we need from the browser's storage. Spelling this out lets
// the tests pass in a pretend storage instead of a real browser.
export type KeyValueStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

// A brand new save: every realm at 0 XP, nothing logged yet.
export function newSave(player: PlayerId): SaveData {
  return {
    version: SAVE_VERSION,
    player,
    realmXp: zeroPerRealm(),
    log: [],
    dailies: defaultDailies(),
    challenges: [],
    skillPoints: zeroPerRealm(),
    shields: SHIELDS_AT_START,
    shieldsFrom: '',
    weekResults: [],
    finishedTiers: [],
    finishedMilestones: [],
    epics: [],
    partner: null,
    partyQuests: defaultPartyQuests(),
    partyLogs: [],
  }
}

// --- small helpers to check that loaded data is what we expect -------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isXpNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isRealmId(value: unknown): value is RealmId {
  return REALMS.some((realm) => realm.id === value)
}

function isPlayerId(value: unknown): value is PlayerId {
  return PLAYERS.some((player) => player.id === value)
}

// A whole number (no fractions) that is zero or more.
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// Text shaped like a day key, e.g. "2026-11-09".
function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// Reads one challenge from loaded data. Returns null if it is not usable.
function readChallenge(value: unknown): Challenge | null {
  if (!isObject(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  if (!isRealmId(value.realm) || !Array.isArray(value.tiers)) return null
  if (!isCount(value.tierIndex) || !isCount(value.weeksDone)) return null
  if (!isDayKey(value.lastCountedWeek) || !isDayKey(value.startedWeek)) return null

  const tiers: ChallengeTier[] = []
  for (const tier of value.tiers) {
    if (
      !isObject(tier) ||
      typeof tier.name !== 'string' ||
      !isCount(tier.daysPerWeek) ||
      !isCount(tier.weeks)
    ) {
      return null
    }
    tiers.push({ name: tier.name, daysPerWeek: tier.daysPerWeek, weeks: tier.weeks })
  }

  return {
    id: value.id,
    realm: value.realm,
    name: value.name,
    dailyId: typeof value.dailyId === 'string' ? value.dailyId : null,
    tiers,
    // Never point past the end of the tier list.
    tierIndex: Math.min(value.tierIndex, tiers.length),
    weeksDone: value.weeksDone,
    lastCountedWeek: value.lastCountedWeek,
    startedWeek: value.startedWeek,
  }
}

// Upgrades an older save to the newest shape, one version at a time.
// Each step only ADDS what the newer version needs; it never throws away
// what the player already has.
function migrate(data: Record<string, unknown>): Record<string, unknown> {
  let upgraded = data

  // Version 1 -> 2: saves had no daily quests yet, so give them the starting
  // list. XP and the log are left exactly as they were.
  if (upgraded.version === 1) {
    upgraded = { ...upgraded, version: 2, dailies: defaultDailies() }
  }

  // Version 2 -> 3: dailies gained a size. Every daily the player already
  // has (including ones they added or renamed) becomes a small one, worth
  // the same 10 XP it was worth before.
  if (upgraded.version === 2) {
    const dailies = Array.isArray(upgraded.dailies)
      ? upgraded.dailies.map((daily: unknown) =>
          isObject(daily) ? { ...daily, xp: XP_SMALL } : daily,
        )
      : upgraded.dailies
    upgraded = { ...upgraded, version: 3, dailies }
  }

  // Version 3 -> 4: challenges and skill points arrive. Nobody has any yet,
  // so both start empty. Everything else is left exactly as it was.
  if (upgraded.version === 3) {
    upgraded = {
      ...upgraded,
      version: 4,
      challenges: [],
      skillPoints: zeroPerRealm(),
    }
  }

  // Version 4 -> 5: shields arrive. Everyone gets the starting shield, and
  // shields begin with the current week: weeks missed before this update
  // are not charged.
  if (upgraded.version === 4) {
    upgraded = {
      ...upgraded,
      version: 5,
      shields: SHIELDS_AT_START,
      shieldsFrom: weekKey(new Date()),
    }
  }

  // Version 5 -> 6: history arrives. Week results were not written down
  // before, so that list starts empty. Finished tiers can be rebuilt from
  // the reward entries in the log: a challenge's first reward was for its
  // first tier, its second reward for its second tier, and so on.
  if (upgraded.version === 5) {
    const finishedTiers: unknown[] = []
    const rewardsSoFar = new Map<string, number>()
    const challenges: unknown[] = Array.isArray(upgraded.challenges)
      ? upgraded.challenges
      : []
    const log: unknown[] = Array.isArray(upgraded.log) ? upgraded.log : []
    for (const entry of log) {
      if (!isObject(entry) || typeof entry.challengeId !== 'string') continue
      if (entry.shield === true) continue // a shield note, not a reward
      const challengeId = entry.challengeId
      const challenge = challenges.find(
        (c) => isObject(c) && c.id === challengeId,
      )
      if (!isObject(challenge)) continue // the challenge was removed since
      const tierIndex = rewardsSoFar.get(challengeId) ?? 0
      rewardsSoFar.set(challengeId, tierIndex + 1)
      const tier: unknown = Array.isArray(challenge.tiers)
        ? challenge.tiers[tierIndex]
        : null
      finishedTiers.push({
        challengeId,
        challengeName: challenge.name,
        tierName: isObject(tier) ? tier.name : `Tier ${tierIndex + 1}`,
        realm: challenge.realm,
        at: entry.at,
      })
    }
    upgraded = { ...upgraded, version: 6, weekResults: [], finishedTiers }
  }

  // Version 6 -> 7: epic quests arrive. Nobody has any yet, so both lists
  // start empty.
  if (upgraded.version === 6) {
    upgraded = { ...upgraded, version: 7, epics: [], finishedMilestones: [] }
  }

  // Version 7 -> 8: the partner view arrives. No code has been pasted yet.
  if (upgraded.version === 7) {
    upgraded = { ...upgraded, version: 8, partner: null }
  }

  // Version 8 -> 9: party quests arrive, with the starting list and
  // nothing logged yet.
  if (upgraded.version === 8) {
    upgraded = {
      ...upgraded,
      version: 9,
      partyQuests: defaultPartyQuests(),
      partyLogs: [],
    }
  }

  return upgraded
}

// Reads one epic quest from loaded data. Returns null if it is not usable.
function readEpic(value: unknown): EpicQuest | null {
  if (!isObject(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  if (!isRealmId(value.realm) || !Array.isArray(value.milestones)) return null

  const milestones: Milestone[] = []
  for (const milestone of value.milestones) {
    if (
      !isObject(milestone) ||
      typeof milestone.id !== 'string' ||
      typeof milestone.name !== 'string'
    ) {
      return null
    }
    milestones.push({
      id: milestone.id,
      name: milestone.name,
      doneAt: typeof milestone.doneAt === 'string' ? milestone.doneAt : null,
    })
  }
  return { id: value.id, realm: value.realm, name: value.name, milestones }
}

// Reads a list of logged party quests from loaded data (a save, or a share
// code), keeping only the ones that look right.
export function readPartyLogs(value: unknown): PartyLog[] {
  const logs: PartyLog[] = []
  if (!Array.isArray(value)) return logs
  for (const item of value) {
    if (
      isObject(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      isPlayerId(item.by) &&
      typeof item.at === 'string' &&
      (item.state === 'pending' ||
        item.state === 'confirmed' ||
        item.state === 'declined')
    ) {
      logs.push({
        id: item.id,
        name: item.name,
        by: item.by,
        at: item.at,
        state: item.state,
      })
    }
  }
  return logs
}

// Is this one of the four ways a challenge week can turn out?
function isWeekOutcome(value: unknown): value is WeekOutcome {
  return (
    value === 'onTarget' ||
    value === 'shielded' ||
    value === 'missed' ||
    value === 'free'
  )
}

// Turns save-file text into SaveData. Returns null if the text is not a save
// we can understand (damaged, or made by a newer version of the app).
// Also used later for "Import save".
export function parseSave(text: string): SaveData | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null // not valid JSON at all
  }
  if (!isObject(raw)) return null
  if (typeof raw.version !== 'number') return null
  if (raw.version > SAVE_VERSION) return null // from a newer app: don't guess

  const data = migrate(raw)
  if (!isPlayerId(data.player)) return null

  // Read each realm's XP. A missing realm starts at 0 (useful if we ever add
  // a realm); a nonsense value means the save is damaged.
  const xpIn = isObject(data.realmXp) ? data.realmXp : {}
  const realmXp = newSave(data.player).realmXp
  for (const realm of REALMS) {
    const value = xpIn[realm.id]
    if (value === undefined) continue
    if (!isXpNumber(value)) return null
    realmXp[realm.id] = value
  }

  // Keep only log entries that look right.
  const log: LogEntry[] = []
  if (Array.isArray(data.log)) {
    for (const entry of data.log) {
      if (
        isObject(entry) &&
        isRealmId(entry.realm) &&
        isXpNumber(entry.xp) &&
        typeof entry.at === 'string'
      ) {
        const logEntry: LogEntry = {
          realm: entry.realm,
          xp: entry.xp,
          at: entry.at,
        }
        if (typeof entry.dailyId === 'string') logEntry.dailyId = entry.dailyId
        if (typeof entry.challengeId === 'string') {
          logEntry.challengeId = entry.challengeId
          if (entry.shield === true) logEntry.shield = true
        }
        if (typeof entry.milestoneId === 'string') {
          logEntry.milestoneId = entry.milestoneId
        }
        if (typeof entry.partyId === 'string') logEntry.partyId = entry.partyId
        log.push(logEntry)
      }
    }
  }

  // The list of daily quests must be there; keep only entries that look right.
  if (!Array.isArray(data.dailies)) return null
  const dailies: Daily[] = []
  for (const daily of data.dailies) {
    if (
      isObject(daily) &&
      typeof daily.id === 'string' &&
      isRealmId(daily.realm) &&
      typeof daily.name === 'string'
    ) {
      dailies.push({
        id: daily.id,
        realm: daily.realm,
        name: daily.name,
        // A size we do not recognise falls back to small, so a daily is
        // never thrown away over it.
        xp: isDailyXp(daily.xp) ? daily.xp : XP_SMALL,
      })
    }
  }

  // Challenges: keep the ones that look right.
  const challenges: Challenge[] = []
  if (Array.isArray(data.challenges)) {
    for (const value of data.challenges) {
      const challenge = readChallenge(value)
      if (challenge !== null) challenges.push(challenge)
    }
  }

  // Skill points per realm, read the same careful way as XP.
  const pointsIn = isObject(data.skillPoints) ? data.skillPoints : {}
  const skillPoints = zeroPerRealm()
  for (const realm of REALMS) {
    const value = pointsIn[realm.id]
    if (value === undefined) continue
    if (!isCount(value)) return null
    skillPoints[realm.id] = value
  }

  // History: keep the lines that look right.
  const weekResults: WeekResult[] = []
  if (Array.isArray(data.weekResults)) {
    for (const value of data.weekResults) {
      if (
        isObject(value) &&
        typeof value.challengeId === 'string' &&
        typeof value.challengeName === 'string' &&
        typeof value.tierName === 'string' &&
        isRealmId(value.realm) &&
        isDayKey(value.week) &&
        isWeekOutcome(value.outcome)
      ) {
        weekResults.push({
          challengeId: value.challengeId,
          challengeName: value.challengeName,
          tierName: value.tierName,
          realm: value.realm,
          week: value.week,
          outcome: value.outcome,
        })
      }
    }
  }
  const finishedTiers: FinishedTier[] = []
  if (Array.isArray(data.finishedTiers)) {
    for (const value of data.finishedTiers) {
      if (
        isObject(value) &&
        typeof value.challengeId === 'string' &&
        typeof value.challengeName === 'string' &&
        typeof value.tierName === 'string' &&
        isRealmId(value.realm) &&
        typeof value.at === 'string'
      ) {
        finishedTiers.push({
          challengeId: value.challengeId,
          challengeName: value.challengeName,
          tierName: value.tierName,
          realm: value.realm,
          at: value.at,
        })
      }
    }
  }

  // Epic quests: keep the ones that look right.
  const epics: EpicQuest[] = []
  if (Array.isArray(data.epics)) {
    for (const value of data.epics) {
      const epic = readEpic(value)
      if (epic !== null) epics.push(epic)
    }
  }
  const finishedMilestones: FinishedMilestone[] = []
  if (Array.isArray(data.finishedMilestones)) {
    for (const value of data.finishedMilestones) {
      if (
        isObject(value) &&
        typeof value.milestoneId === 'string' &&
        typeof value.epicName === 'string' &&
        typeof value.milestoneName === 'string' &&
        isRealmId(value.realm) &&
        typeof value.at === 'string'
      ) {
        finishedMilestones.push({
          milestoneId: value.milestoneId,
          epicName: value.epicName,
          milestoneName: value.milestoneName,
          realm: value.realm,
          at: value.at,
        })
      }
    }
  }

  // Party quests: the list, then everything logged.
  const partyQuests: PartyQuest[] = []
  if (Array.isArray(data.partyQuests)) {
    for (const value of data.partyQuests) {
      if (
        isObject(value) &&
        typeof value.id === 'string' &&
        typeof value.name === 'string'
      ) {
        partyQuests.push({ id: value.id, name: value.name })
      }
    }
  }
  const partyLogs = readPartyLogs(data.partyLogs)

  return {
    version: SAVE_VERSION,
    player: data.player,
    realmXp,
    log,
    dailies,
    challenges,
    skillPoints,
    // Never more than the most a player can hold. A value we cannot read
    // falls back to the starting amount.
    shields: isCount(data.shields)
      ? Math.min(data.shields, MAX_SHIELDS)
      : SHIELDS_AT_START,
    shieldsFrom: isDayKey(data.shieldsFrom) ? data.shieldsFrom : '',
    weekResults,
    finishedTiers,
    finishedMilestones,
    epics,
    // A partner summary we cannot read is dropped; pasting a fresh code
    // brings it back.
    partner: readPartnerSummary(data.partner),
    partyQuests,
    partyLogs,
  }
}

// Asks the browser to treat our data as important, so it is not cleared when
// the phone runs low on space. The browser may say no; that is fine, the app
// still works, which is why weekly backups from Camp matter.
export async function askToKeepData(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Not supported here: nothing to do.
  }
}

// --- export / import --------------------------------------------------------

// The save as neatly laid-out text, ready to put in a backup file.
// parseSave() above is its opposite: it reads this text back in.
export function saveToText(save: SaveData): string {
  return JSON.stringify(save, null, 2)
}

// A file name for a backup, e.g. "liferpg-rachit-2026-11-14.txt".
// The date is the phone's local date, so backups sort nicely by day.
export function exportFileName(save: SaveData, now: Date): string {
  return `liferpg-${save.player}-${dayKey(now)}.txt`
}

// Reads the save from this device. Returns null when there is no save yet
// (first launch) or it cannot be read.
export function loadSave(store: KeyValueStore = localStorage): SaveData | null {
  try {
    const text = store.getItem(SAVE_KEY)
    if (text === null) return null // first launch

    const save = parseSave(text)
    if (save === null) {
      // Golden rule: never wipe progress. If we cannot read the save, keep a
      // copy of the raw text so it can be rescued before anything overwrites it.
      store.setItem(BACKUP_KEY, text)
    }
    return save
  } catch {
    return null // storage is blocked (e.g. some private browsing modes)
  }
}

// Writes the save to this device. Returns true if it worked.
export function writeSave(
  save: SaveData,
  store: KeyValueStore = localStorage,
): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false // storage full or blocked
  }
}
