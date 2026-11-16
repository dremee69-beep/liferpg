// RECENT ACTIVITY: everything you have logged, newest first, with a Remove
// button on each entry so any mistake can be fixed later, not just the last one.

import { useState } from 'react'
import { dayKey } from '../game/dates.ts'
import { REALMS } from '../game/rules.ts'
import type { LogEntry, SaveData } from '../storage/save.ts'
import { ConfirmButton } from './ConfirmButton.tsx'
import { PixelIcon } from './PixelIcon.tsx'

type Props = {
  save: SaveData
  now: Date
  // `index` is the entry's position in save.log.
  onRemove: (index: number) => void
}

// How many entries to show at first, and how many more per "Show more" tap.
const PAGE_SIZE = 8

// What an entry was: the daily's name, or a plain logged action.
function describe(entry: LogEntry, save: SaveData): string {
  // Bonus XP for finishing a challenge tier.
  if (entry.challengeId !== undefined) {
    const challenge = save.challenges.find((c) => c.id === entry.challengeId)
    return challenge ? `Tier complete: ${challenge.name}` : 'Challenge tier complete'
  }
  if (entry.dailyId !== undefined) {
    const daily = save.dailies.find((d) => d.id === entry.dailyId)
    return daily?.name ?? 'Daily quest'
  }
  return 'Logged action'
}

// Just the time for today's entries, "12 Nov, 6:52 pm" for older ones.
function describeTime(entry: LogEntry, now: Date): string {
  const when = new Date(entry.at)
  const time = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (dayKey(when) === dayKey(now)) return time
  const date = when.toLocaleDateString([], { day: 'numeric', month: 'short' })
  return `${date}, ${time}`
}

export function ActivityLog({ save, now, onRemove }: Props) {
  const [shown, setShown] = useState(PAGE_SIZE)

  // Pair every entry with its position, then put the newest first.
  const newestFirst = save.log
    .map((entry, index) => ({ entry, index }))
    .reverse()
  const visible = newestFirst.slice(0, shown)

  return (
    <section className="panel activity">
      <h2>Recent activity</h2>

      {newestFirst.length === 0 ? (
        <p className="panel-text">
          Nothing logged yet. Everything you log appears here, and you can
          remove any entry made by mistake.
        </p>
      ) : (
        <ul className="activity-list">
          {visible.map(({ entry, index }) => {
            const realm = REALMS.find((r) => r.id === entry.realm)
            return (
              // The key names this exact entry (position + time), so a
              // half-confirmed Remove can never jump to a different entry.
              <li
                key={`${index}-${entry.at}`}
                className="activity-item"
                data-realm={entry.realm}
              >
                <PixelIcon name={entry.realm} size={24} />
                <div className="activity-text">
                  <span className="activity-what">{describe(entry, save)}</span>
                  <span className="activity-meta">
                    {realm?.name} · +{entry.xp} XP · {describeTime(entry, now)}
                  </span>
                </div>
                {entry.challengeId === undefined ? (
                  <ConfirmButton label="Remove" onConfirm={() => onRemove(index)} />
                ) : (
                  // A tier reward belongs to the finished tier, so it stays.
                  <span className="activity-reward">Reward</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {newestFirst.length > shown && (
        <button
          type="button"
          className="button button-wide"
          onClick={() => setShown(shown + PAGE_SIZE)}
        >
          Show more
        </button>
      )}
    </section>
  )
}
