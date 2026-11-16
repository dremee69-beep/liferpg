// HISTORY: look back at everything you have done.
// Three views, switched with the buttons at the top:
//   Days   - each day's actions and XP;
//   Weeks  - each week's totals, and how every challenge week turned out;
//   Quests - every challenge tier and epic quest milestone you have finished.

import { useState } from 'react'
import { dateFromDayKey, dayKey, weekKey } from '../game/dates.ts'
import { daysHistory, describeEntry, weeksHistory } from '../game/history.ts'
import {
  EPIC_MILESTONE_XP,
  REALMS,
  TIER_REWARD_SKILL_POINTS,
  TIER_REWARD_XP,
} from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import type { SaveData, WeekOutcome } from '../storage/save.ts'
import { Icon } from './Icon.tsx'

type Props = {
  save: SaveData
  now: Date
  onBack: () => void
}

const VIEWS = [
  { id: 'days', name: 'Days' },
  { id: 'weeks', name: 'Weeks' },
  { id: 'quests', name: 'Quests' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

// How many days or weeks to show at first, and how many more per tap.
const PAGE_SIZE = 7

// What each week outcome is called on screen.
const OUTCOME_NAMES: Record<WeekOutcome, string> = {
  onTarget: 'On target ✓',
  shielded: 'Shield used',
  missed: 'Missed',
  free: 'Free pass',
}

function realmName(realm: RealmId): string {
  return REALMS.find((r) => r.id === realm)?.name ?? ''
}

// "1 action" but "2 actions".
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// "Mon, 16 Nov" (with the year for dates not in this year).
function describeDay(day: string, now: Date): string {
  const date = dateFromDayKey(day)
  return date.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

function describeTime(at: string): string {
  return new Date(at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function History({ save, now, onBack }: Props) {
  const [view, setView] = useState<ViewId>('days')
  const [shown, setShown] = useState(PAGE_SIZE)

  const days = daysHistory(save)
  const weeks = weeksHistory(save)
  // Finished challenge tiers and epic quest milestones in one list,
  // newest first.
  const tiers = [
    ...save.finishedTiers.map((tier) => ({
      realm: tier.realm,
      at: tier.at,
      what: `${tier.challengeName}: ${tier.tierName}`,
      kind: 'Challenge tier',
      reward: `+${TIER_REWARD_XP} XP · +${TIER_REWARD_SKILL_POINTS} pt`,
    })),
    ...save.finishedMilestones.map((milestone) => ({
      realm: milestone.realm,
      at: milestone.at,
      what: `${milestone.epicName}: ${milestone.milestoneName}`,
      kind: 'Epic milestone',
      reward: `+${EPIC_MILESTONE_XP} XP`,
    })),
    // ISO date text sorts correctly as plain text.
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  // How many groups the open view has, for the "Show more" button.
  const total =
    view === 'days' ? days.length : view === 'weeks' ? weeks.length : tiers.length

  return (
    <main className="screen history">
      <header className="screen-header history-header">
        <div>
          <h1>History</h1>
          <p className="screen-subtitle">
            {plural(save.log.filter((e) => e.challengeId === undefined).length, 'action')}{' '}
            logged so far
          </p>
        </div>
        <button type="button" className="link-button" onClick={onBack}>
          Back
        </button>
      </header>

      {/* The Days / Weeks / Quests switch. */}
      <div className="segments" role="group" aria-label="History view">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === view ? 'segment segment-current' : 'segment'}
            aria-pressed={option.id === view}
            onClick={() => {
              setView(option.id)
              setShown(PAGE_SIZE)
            }}
          >
            {option.name}
          </button>
        ))}
      </div>

      {/* ----- Days ----- */}
      {view === 'days' &&
        (days.length === 0 ? (
          <section className="panel">
            <p className="panel-text">
              Nothing logged yet. Every day you log something gets a card here.
            </p>
          </section>
        ) : (
          days.slice(0, shown).map((day) => (
            <section key={day.day} className="panel">
              <div className="panel-top">
                <h2>
                  {day.day === dayKey(now) ? 'Today' : describeDay(day.day, now)}
                </h2>
                <span className="points-chip">+{day.xp} XP</span>
              </div>
              <ul className="activity-list">
                {day.entries.map((entry, index) => (
                  <li
                    key={`${index}-${entry.at}`}
                    className="activity-item history-item"
                    data-realm={entry.realm}
                  >
                    <Icon
                      name={entry.shield === true ? 'shield' : entry.realm}
                      size={24}
                    />
                    <div className="activity-text">
                      <span className="activity-what">
                        {describeEntry(entry, save)}
                      </span>
                      <span className="activity-meta">
                        {realmName(entry.realm)} · {describeTime(entry.at)}
                      </span>
                    </div>
                    <span className="history-xp">
                      {entry.shield === true ? 'Shield' : `+${entry.xp}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ))}

      {/* ----- Weeks ----- */}
      {view === 'weeks' &&
        (weeks.length === 0 ? (
          <section className="panel">
            <p className="panel-text">
              Nothing logged yet. Each week gets a summary here.
            </p>
          </section>
        ) : (
          weeks.slice(0, shown).map((week) => (
            <section key={week.week} className="panel">
              <div className="panel-top">
                <h2>
                  {week.week === weekKey(now)
                    ? 'This week'
                    : `Week of ${describeDay(week.week, now).replace(/^\w+,?\s/, '')}`}
                </h2>
                <span className="points-chip">+{week.xp} XP</span>
              </div>
              <p className="panel-text">
                {week.actions === 0
                  ? 'Nothing logged this week.'
                  : `${plural(week.actions, 'action')} logged, including ${plural(week.dailies, 'daily quest')}.`}
              </p>
              {week.results.map((result, index) => (
                <p
                  key={index}
                  className="realm-challenge history-result"
                  data-realm={result.realm}
                >
                  <span className="realm-challenge-name">
                    {result.challengeName}
                    <span className="history-tier"> · {result.tierName}</span>
                  </span>
                  <span>{OUTCOME_NAMES[result.outcome]}</span>
                </p>
              ))}
            </section>
          ))
        ))}

      {/* ----- Finished quests ----- */}
      {view === 'quests' && (
        <section className="panel">
          <h2>Finished quests</h2>
          {tiers.length === 0 ? (
            <p className="panel-text">
              None yet. Every challenge tier you finish and every epic quest
              milestone you tick is listed here, with its date.
            </p>
          ) : (
            <ul className="activity-list">
              {tiers.slice(0, shown).map((tier, index) => (
                <li
                  key={`${index}-${tier.at}`}
                  className="activity-item history-item"
                  data-realm={tier.realm}
                >
                  <Icon name={tier.realm} size={24} />
                  <div className="activity-text">
                    <span className="activity-what">{tier.what}</span>
                    <span className="activity-meta">
                      {tier.kind} · {realmName(tier.realm)} ·{' '}
                      {describeDay(dayKey(new Date(tier.at)), now)}
                    </span>
                  </div>
                  <span className="history-xp">{tier.reward}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {total > shown && (
        <button
          type="button"
          className="button button-wide"
          onClick={() => setShown(shown + PAGE_SIZE)}
        >
          Show more
        </button>
      )}
    </main>
  )
}
