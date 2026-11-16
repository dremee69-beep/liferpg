// SHARE WITH YOUR PARTNER: send your share code, and paste theirs.
// A share code is a short block of text holding your name, levels and
// shields. It goes to your partner over WhatsApp; nothing is sent anywhere
// by the app itself.

import { useState } from 'react'
import { PARTY_QUEST_XP, PLAYERS } from '../game/rules.ts'
import { daysSince, makeShareCode } from '../game/share.ts'
import type { PartnerCodeResult, ShareProblem } from '../game/share.ts'
import type { SaveData } from '../storage/save.ts'

type Props = {
  save: SaveData
  now: Date
  // Hands the pasted text to the app. Comes back with the reason it was
  // not used, or null when it worked.
  onPartnerCode: (text: string) => PartnerCodeResult
}

// What to tell the player when a pasted code was not used.
const PROBLEM_TEXT: Record<ShareProblem, string> = {
  unreadable:
    'That does not look like a share code. Copy the whole message your partner sent and try again.',
  own: 'That is your own code. Paste the one your partner sent you.',
  older: 'You already have a newer code from your partner, so this one was not used.',
}

// "today", "yesterday" or "3 days ago".
export function describeAge(at: string, now: Date): string {
  const days = daysSince(at, now)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function SharePanel({ save, now, onPartnerCode }: Props) {
  const [pasted, setPasted] = useState('')
  // A note under the buttons: what just happened, and whether it went well.
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)

  // The other player's name, e.g. "Deepika" on Rachit's phone.
  const partnerName =
    PLAYERS.find((p) => p.id !== save.player)?.name ?? 'your partner'
  const canShare = typeof navigator.share === 'function'

  // Send: opens the phone's share sheet (WhatsApp...). On a device without
  // one, the code is copied instead, ready to paste into a chat.
  async function handleSend() {
    const code = makeShareCode(save, new Date())
    const text = `My LifeRPG share code:\n${code}`
    try {
      if (canShare) {
        await navigator.share({ text })
        setNote({ text: 'Share code sent.', ok: true })
      } else {
        await navigator.clipboard.writeText(text)
        setNote({ text: 'Share code copied. Paste it into a chat.', ok: true })
      }
    } catch (error) {
      // "AbortError" just means the player closed the share sheet.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNote({ text: 'Sending did not work here.', ok: false })
    }
  }

  function handleUse() {
    const { problem, news } = onPartnerCode(pasted)
    if (problem !== null) {
      setNote({ text: PROBLEM_TEXT[problem], ok: false })
      return
    }
    setPasted('')

    // Say what the code brought with it, party quests first.
    const lines = ['Code read. Their card is on the Village screen.']
    if (news.confirmed.length > 0) {
      const xp = news.confirmed.length * PARTY_QUEST_XP
      const names = news.confirmed.map((log) => log.name).join(', ')
      lines.push(`${partnerName} confirmed: ${names}. +${xp} Together XP!`)
    }
    if (news.toConfirm.length > 0) {
      const names = news.toConfirm.map((log) => log.name).join(', ')
      lines.push(`Waiting for you on the Quests screen: ${names}.`)
    }
    if (news.declined.length > 0) {
      const names = news.declined.map((log) => log.name).join(', ')
      lines.push(`${partnerName} declined: ${names}.`)
    }
    setNote({ text: lines.join(' '), ok: true })
  }

  return (
    <section className="panel">
      <h2>Share with your partner</h2>
      <p className="panel-text">
        A share code shows your partner your levels and shields, and carries
        your party quests to them for confirming. Send yours on WhatsApp, and
        paste theirs below. It holds no dailies, challenges, epic quests or
        history.
      </p>

      <button
        type="button"
        className="button button-strong button-wide"
        onClick={handleSend}
      >
        {canShare ? 'Send my share code' : 'Copy my share code'}
      </button>

      <label className="field">
        <span className="field-label">Paste your partner's code</span>
        <textarea
          className="edit-input edit-textarea share-paste"
          rows={3}
          value={pasted}
          placeholder="LRPG1..."
          onChange={(event) => setPasted(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="button button-wide"
        disabled={pasted.trim() === ''}
        onClick={handleUse}
      >
        Use this code
      </button>

      {note !== null && (
        <p className={note.ok ? 'panel-message' : 'import-error'} role="status">
          {note.text}
        </p>
      )}

      {save.partner !== null && (
        <p className="panel-text">
          Latest code from {partnerName}: {describeAge(save.partner.at, now)}.
        </p>
      )}
    </section>
  )
}
