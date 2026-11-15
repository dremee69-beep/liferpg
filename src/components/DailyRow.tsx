// ONE DAILY QUEST ROW: tap once to tick it off for today.
// Used on the realm cards in the Village and in the Quest log.

import { useState } from 'react'
import type { DailyStatus } from '../game/dailies.ts'
import { useXpPops } from './XpPops.tsx'

type Props = {
  daily: DailyStatus
  onTick: (dailyId: string) => void
}

export function DailyRow({ daily, onTick }: Props) {
  const pops = useXpPops()
  // True only when this row was ticked just now, so the "pop" animation
  // plays for a fresh tick and not every time the screen is opened.
  const [justTicked, setJustTicked] = useState(false)

  let className = 'daily'
  if (daily.doneToday) className += ' daily-done'
  if (daily.doneToday && justTicked) className += ' daily-just-ticked'

  return (
    <button
      type="button"
      className={className}
      disabled={daily.doneToday}
      onClick={() => {
        setJustTicked(true)
        pops.fire(`+${daily.xp}`)
        onTick(daily.id)
      }}
    >
      <span className="daily-box" aria-hidden="true">
        {daily.doneToday ? '✓' : ''}
      </span>
      <span className="daily-name">{daily.name}</span>
      <span className="daily-xp">
        {daily.doneToday ? 'Done today' : `+${daily.xp}`}
      </span>
      {pops.element}
    </button>
  )
}
