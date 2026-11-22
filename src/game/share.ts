// SHARE CODES
// The two phones never talk to each other: there is no server. To show your
// partner your progress, the app makes a "share code", a short block of text
// you send on WhatsApp. Your partner pastes it into their app.
//
// A share code holds a small summary only: who you are, your XP in each
// realm, your shields, when the code was made, and your latest party quests
// and map pins (so your partner can confirm them). It never holds your
// dailies, challenges, epic quests, history or photos.
//
// Like the other game files, nothing here changes the save it is given.

import { MAX_SHIELDS, PLAYERS, REALMS } from './rules.ts'
import type { PlayerId } from './rules.ts'
import type { RealmXp } from './xp.ts'
import { mergePartyLogs, partyLogsForCode } from './party.ts'
import type { PartyNews } from './party.ts'
import { mergePins, NO_PIN_NEWS, pinsForCode } from './pins.ts'
import type { PinNews } from './pins.ts'
import { readPartyLogs, readPins } from '../storage/save.ts'
import type { PartyLog, Pin, SaveData } from '../storage/save.ts'

// What a share code says about a player.
export type PartnerSummary = {
  player: PlayerId
  realmXp: RealmXp
  shields: number
  at: string // when the code was made (ISO date text)
}

// Every share code starts with this, so the app can spot one inside a longer
// WhatsApp message. The 1 is the code's version, in case its shape changes.
const PREFIX = 'LRPG1.'

// --- turning text into code letters and back --------------------------------
// The summary is written as JSON, then turned into "base64": plain letters,
// digits, - and _, which survive being copied through any chat app.

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(code: string): string | null {
  try {
    const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (letter) => letter.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null // not valid base64
  }
}

// ---------------------------------------------------------------------------
// Making and reading codes
// ---------------------------------------------------------------------------

// The share code for this save, as it stands right now.
export function makeShareCode(save: SaveData, now: Date): string {
  const summary: PartnerSummary = {
    player: save.player,
    realmXp: save.realmXp,
    shields: save.shields,
    at: now.toISOString(),
  }
  // The latest party quests and pins ride along next to the summary.
  const extras = { party: partyLogsForCode(save), pins: pinsForCode(save) }
  return PREFIX + encode(JSON.stringify({ ...summary, ...extras }))
}

// Checks that loaded data really is a partner summary. Returns a clean copy,
// or null if anything about it looks wrong. (Also used when loading a save.)
export function readPartnerSummary(value: unknown): PartnerSummary | null {
  if (typeof value !== 'object' || value === null) return null
  const data = value as Record<string, unknown>

  const player = PLAYERS.find((p) => p.id === data.player)?.id
  if (player === undefined) return null

  if (typeof data.realmXp !== 'object' || data.realmXp === null) return null
  const xpIn = data.realmXp as Record<string, unknown>
  const realmXp: RealmXp = { health: 0, mind: 0, wealth: 0, together: 0, questAbroad: 0 }
  for (const realm of REALMS) {
    const xp = xpIn[realm.id]
    if (typeof xp !== 'number' || !Number.isFinite(xp) || xp < 0) return null
    realmXp[realm.id] = xp
  }

  const shields = data.shields
  if (typeof shields !== 'number' || !Number.isInteger(shields) || shields < 0) {
    return null
  }

  if (typeof data.at !== 'string' || Number.isNaN(new Date(data.at).getTime())) {
    return null
  }

  return { player, realmXp, shields: Math.min(shields, MAX_SHIELDS), at: data.at }
}

// Finds a share code in pasted text and reads it. The text can have other
// words around the code (for example the rest of a WhatsApp message).
// Returns null when there is no code, or it is damaged.
export function readShareCode(
  text: string,
): { summary: PartnerSummary; party: PartyLog[]; pins: Pin[] } | null {
  const found = text.match(/LRPG1\.([A-Za-z0-9_-]+)/)
  if (found === null) return null
  const json = decode(found[1])
  if (json === null) return null
  try {
    const data: unknown = JSON.parse(json)
    const summary = readPartnerSummary(data)
    if (summary === null) return null
    // A code from before party quests existed simply has none.
    const party = readPartyLogs((data as { party?: unknown }).party)
    // The same for pins. A photo is never taken from a code.
    const pins = readPins((data as { pins?: unknown }).pins).map(
      ({ photo: _photo, ...pin }) => pin,
    )
    return { summary, party, pins }
  } catch {
    return null // the code was cut short or changed
  }
}

// ---------------------------------------------------------------------------
// Using a partner's code
// ---------------------------------------------------------------------------

// Why a pasted code was not used:
//   'unreadable' no share code in the text, or it is damaged;
//   'own'        it is this player's own code;
//   'older'      the app already has a newer code from the partner.
export type ShareProblem = 'unreadable' | 'own' | 'older'

// What the screen is told after a code was pasted: the problem (if it was
// not used) and the party quest and pin news (if it was).
export type PartnerCodeResult = {
  problem: ShareProblem | null
  news: PartyNews
  pinNews: PinNews
}

const NO_NEWS: PartyNews = { toConfirm: [], confirmed: [], declined: [] }

// Remember what a partner's code says, and take in its party quests (which
// may pay XP for ones the partner confirmed) and its pins. Hands back the
// new save and the news, or the very same save together with the problem.
export function applyPartnerCode(
  save: SaveData,
  text: string,
  now: Date,
): { save: SaveData } & PartnerCodeResult {
  const nothing = { save, news: NO_NEWS, pinNews: NO_PIN_NEWS }
  const code = readShareCode(text)
  if (code === null) return { ...nothing, problem: 'unreadable' }
  if (code.summary.player === save.player) return { ...nothing, problem: 'own' }
  // ISO date text sorts correctly as plain text.
  if (save.partner !== null && code.summary.at < save.partner.at) {
    return { ...nothing, problem: 'older' }
  }
  const party = mergePartyLogs({ ...save, partner: code.summary }, code.party, now)
  const pins = mergePins(party.save, code.pins)
  return { save: pins.save, problem: null, news: party.news, pinNews: pins.news }
}

// How many whole days ago a code was made: 0 for today, 1 for yesterday...
// Counted in calendar days on this phone, not in 24-hour blocks.
export function daysSince(at: string, now: Date): number {
  const then = new Date(at)
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((startOfNow.getTime() - startOfThen.getTime()) / 86_400_000)
  return Math.max(0, days)
}
