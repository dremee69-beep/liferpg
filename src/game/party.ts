// PARTY QUESTS
// Things you do as a pair: date night, cooking together, a walk. Either
// player logs one, and it pays Together XP to BOTH players once the other
// one confirms it.
//
// The two phones never talk directly, so this happens through share codes:
//   1. You log a party quest. It waits ("pending") and pays nothing yet.
//   2. Your next share code carries it to your partner.
//   3. Your partner confirms it. Their phone pays them the XP.
//   4. Their next share code carries the confirmation back, and your phone
//      pays you the same XP.
//
// Like the other game files, nothing here changes the save it is given: each
// function hands back a fresh copy, or the very same save when nothing changed.

import {
  MAX_PARTY_LOGS,
  MAX_PARTY_QUEST_NAME_LENGTH,
  MAX_PARTY_QUESTS,
  PARTY_LOGS_IN_CODE,
  PARTY_QUEST_XP,
} from './rules.ts'
import type { PartyLog, SaveData } from '../storage/save.ts'

// ---------------------------------------------------------------------------
// The list of party quests
// ---------------------------------------------------------------------------

// Tidies a typed name. Returns null when nothing is left.
export function cleanPartyName(typed: string): string | null {
  const name = typed.trim().slice(0, MAX_PARTY_QUEST_NAME_LENGTH).trim()
  return name === '' ? null : name
}

export function canAddPartyQuest(save: SaveData): boolean {
  return save.partyQuests.length < MAX_PARTY_QUESTS
}

export function addPartyQuest(save: SaveData, typed: string, now: Date): SaveData {
  const name = cleanPartyName(typed)
  if (name === null || !canAddPartyQuest(save)) return save

  // Build an id nothing else is using.
  let id = `party-${now.getTime().toString(36)}`
  while (save.partyQuests.some((quest) => quest.id === id)) id = `${id}x`

  return { ...save, partyQuests: [...save.partyQuests, { id, name }] }
}

// Remove a party quest from the list. Anything already logged is kept.
export function removePartyQuest(save: SaveData, questId: string): SaveData {
  if (!save.partyQuests.some((quest) => quest.id === questId)) return save
  return {
    ...save,
    partyQuests: save.partyQuests.filter((quest) => quest.id !== questId),
  }
}

// ---------------------------------------------------------------------------
// Logging, confirming, declining, cancelling
// ---------------------------------------------------------------------------

// Keeps the list of logs from growing for ever: the oldest fall off the end.
function trimmed(logs: PartyLog[]): PartyLog[] {
  return logs.length > MAX_PARTY_LOGS ? logs.slice(-MAX_PARTY_LOGS) : logs
}

// Pays the Together XP for one confirmed party quest and notes it in the log.
function payFor(save: SaveData, log: PartyLog, now: Date): SaveData {
  return {
    ...save,
    realmXp: {
      ...save.realmXp,
      together: save.realmXp.together + PARTY_QUEST_XP,
    },
    log: [
      ...save.log,
      {
        realm: 'together',
        xp: PARTY_QUEST_XP,
        at: now.toISOString(),
        partyId: log.id,
      },
    ],
  }
}

// Log a party quest. It starts as "pending": no XP until the partner
// confirms. Does nothing if the quest is not on the list.
export function logPartyQuest(save: SaveData, questId: string, now: Date): SaveData {
  const quest = save.partyQuests.find((q) => q.id === questId)
  if (quest === undefined) return save

  // The id starts with who logged it, so the two phones can never make the
  // same id by accident.
  let id = `${save.player}-${now.getTime().toString(36)}`
  while (save.partyLogs.some((log) => log.id === id)) id = `${id}x`

  const log: PartyLog = {
    id,
    name: quest.name,
    by: save.player,
    at: now.toISOString(),
    state: 'pending',
  }
  return { ...save, partyLogs: trimmed([...save.partyLogs, log]) }
}

// Swap one log for a changed copy.
function withLog(save: SaveData, changed: PartyLog): SaveData {
  return {
    ...save,
    partyLogs: save.partyLogs.map((log) => (log.id === changed.id ? changed : log)),
  }
}

// Confirm a party quest your PARTNER logged: it is marked confirmed and you
// are paid the XP. Does nothing for your own logs, or ones not pending.
export function confirmPartyLog(save: SaveData, logId: string, now: Date): SaveData {
  const log = save.partyLogs.find((l) => l.id === logId)
  if (log === undefined || log.by === save.player || log.state !== 'pending') {
    return save
  }
  const confirmed: PartyLog = { ...log, state: 'confirmed' }
  return payFor(withLog(save, confirmed), confirmed, now)
}

// Say no to a party quest your partner logged. Nobody is paid.
export function declinePartyLog(save: SaveData, logId: string): SaveData {
  const log = save.partyLogs.find((l) => l.id === logId)
  if (log === undefined || log.by === save.player || log.state !== 'pending') {
    return save
  }
  return withLog(save, { ...log, state: 'declined' })
}

// Take back a party quest YOU logged, while it is still waiting or after it
// was declined. A confirmed one stays.
export function cancelPartyLog(save: SaveData, logId: string): SaveData {
  const log = save.partyLogs.find((l) => l.id === logId)
  if (log === undefined || log.by !== save.player || log.state === 'confirmed') {
    return save
  }
  return { ...save, partyLogs: save.partyLogs.filter((l) => l.id !== logId) }
}

// ---------------------------------------------------------------------------
// Share codes
// ---------------------------------------------------------------------------

// The logs that travel in a share code: the newest few.
export function partyLogsForCode(save: SaveData): PartyLog[] {
  return save.partyLogs.slice(-PARTY_LOGS_IN_CODE)
}

// What changed when a partner's code was read.
export type PartyNews = {
  toConfirm: PartyLog[] // new quests the partner logged, waiting for you
  confirmed: PartyLog[] // your quests the partner confirmed: XP was just paid
  declined: PartyLog[] // your quests the partner declined
}

// Take in the party quests from a partner's share code.
//   - A quest THEY logged that this phone has not seen is added, waiting
//     for you to confirm.
//   - A quest YOU logged that they have confirmed is marked confirmed here
//     and you are paid. (This also brings back one you had cancelled: once
//     they confirmed it, it counts for both.)
//   - A quest YOU logged that they declined is marked declined.
// Everything else is left as it is, so reading the same code twice changes
// nothing the second time.
export function mergePartyLogs(
  save: SaveData,
  incoming: PartyLog[],
  now: Date,
): { save: SaveData; news: PartyNews } {
  const news: PartyNews = { toConfirm: [], confirmed: [], declined: [] }
  let next = save

  for (const theirs of incoming) {
    const mine = next.partyLogs.find((log) => log.id === theirs.id)

    if (theirs.by !== save.player) {
      // Logged by the partner. Only news if this phone has never seen it.
      if (mine === undefined && theirs.state === 'pending') {
        next = { ...next, partyLogs: trimmed([...next.partyLogs, theirs]) }
        news.toConfirm.push(theirs)
      }
      continue
    }

    // Logged by this player: the partner's code says what they decided.
    if (theirs.state === 'confirmed' && mine?.state !== 'confirmed') {
      const confirmed: PartyLog = { ...theirs, state: 'confirmed' }
      next =
        mine === undefined
          ? { ...next, partyLogs: trimmed([...next.partyLogs, confirmed]) }
          : withLog(next, confirmed)
      next = payFor(next, confirmed, now)
      news.confirmed.push(confirmed)
    } else if (theirs.state === 'declined' && mine?.state === 'pending') {
      const declined: PartyLog = { ...mine, state: 'declined' }
      next = withLog(next, declined)
      news.declined.push(declined)
    }
  }

  return { save: next, news }
}
