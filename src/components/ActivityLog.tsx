// RECENT ACTIVITY: everything you have logged, newest first, with a Remove
// button on each entry so any mistake can be fixed later, not just the last one.

import { useState } from 'react'
import { dayKey } from '../game/dates.ts'
import { describeEntry } from '../game/history.ts'
import { REALMS } from '../game/rules.ts'
import type { LogEntry, SaveData } from '../storage/save.ts'
import { ConfirmButton } from './ConfirmButton.tsx'
import { Icon } from './Icon.tsx'

type Props = {
  save: SaveData
  now: Date
  // `index` is the entry's position in save.log.
  onRemove: (index: number) => void
  onOpenHistory: () => void
}

// How many entries to show at first, and how many more per "Show more" tap.
const PAGE_SIZE = 8

// Just the time for today's entries, "12 Nov, 6:52 pm" for older ones.
function describeTime(entry: LogEntry, now: Date): string {
  const when = new Date(entry.at)
  const time = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (dayKey(when) === dayKey(now)) return time
  const date = when.toLocaleDateString([], { day: 'numeric', month: 'short' })
  return `${date}, ${time}`
}

export function ActivityLog({ save, now, onRemove, onOpenHistory }: Props) {
  const [shown, setShown] = useState(PAGE_SIZE)

  // Pair every entry with its position, then put the newest first.
  const newestFirst = save.log
    .map((entry, index) => ({ entry, index }))
    .reverse()
  const visible = newestFirst.slice(0, shown)

  return (
    <section className="panel activity">
      <div className="panel-top">
        <h2>Recent activity</h2>
        {/* Opens the History screen: every day, week and finished quest. */}
        <button type="button" className="link-button" onClick={onOpenHistory}>
          History
        </button>
      </div>

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
                <Icon
                  name={entry.shield === true ? 'shield' : entry.realm}
                  size={24}
                />
                <div className="activity-text">
                  <span className="activity-what">{describeEntry(entry, save)}</span>
                  <span className="activity-meta">
                    {realm?.name} ·{' '}
                    {entry.shield === true
                      ? 'covered a missed week'
                      : `+${entry.xp} XP`}{' '}
                    · {describeTime(entry, now)}
                  </span>
                </div>
                {entry.challengeId === undefined ? (
                  <ConfirmButton label="Remove" onConfirm={() => onRemove(index)} />
                ) : (
                  // Tier rewards and shield notes belong to the challenge,
                  // so they stay.
                  <span className="activity-reward">
                    {entry.shield === true ? 'Shield' : 'Reward'}
                  </span>
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
