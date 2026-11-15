// ONE DAILY QUEST ROW: tap once to tick it off for today.
// Used on the realm cards in the Village and in the Quest log.

import type { DailyStatus } from '../game/dailies.ts'

type Props = {
  daily: DailyStatus
  onTick: (dailyId: string) => void
}

export function DailyRow({ daily, onTick }: Props) {
  return (
    <button
      type="button"
      className={daily.doneToday ? 'daily daily-done' : 'daily'}
      disabled={daily.doneToday}
      onClick={() => onTick(daily.id)}
    >
      <span className="daily-box" aria-hidden="true">
        {daily.doneToday ? '✓' : ''}
      </span>
      <span className="daily-name">{daily.name}</span>
      <span className="daily-xp">
        {daily.doneToday ? 'Done today' : `+${daily.xp}`}
      </span>
    </button>
  )
}
