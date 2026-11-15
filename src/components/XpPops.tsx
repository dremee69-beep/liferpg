// FLOATING XP NUMBERS: the little "+10" that rises from a button you tapped.
//
// A button uses it like this:
//   const pops = useXpPops()
//   <button onClick={() => { pops.fire('+10'); ... }}> ... {pops.element}</button>
// The button needs "position: relative" in the CSS so the number starts on it.

import { useRef, useState } from 'react'

type Pop = { id: number; text: string }

export function useXpPops() {
  const [pops, setPops] = useState<Pop[]>([])
  const nextId = useRef(0) // gives every pop its own number

  // Start a new floating number.
  function fire(text: string) {
    const id = nextId.current
    nextId.current = id + 1
    setPops((current) => [...current, { id, text }])
  }

  const element = (
    <>
      {pops.map((pop) => (
        <span
          key={pop.id}
          className="xp-pop"
          aria-hidden="true"
          // When its animation finishes, take it off the screen.
          onAnimationEnd={() =>
            setPops((current) => current.filter((p) => p.id !== pop.id))
          }
        >
          {pop.text}
        </span>
      ))}
    </>
  )

  return { fire, element }
}
