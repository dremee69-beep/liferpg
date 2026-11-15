// A BUTTON THAT NEEDS TWO TAPS
// For things that cannot be undone, like removing an entry. The first tap
// turns it red and changes its words; the second tap does the action.
// Tapping anywhere else cancels.

import { useState } from 'react'

type Props = {
  label: string // what it says normally, e.g. "Remove"
  confirmLabel?: string // what it says after the first tap
  disabled?: boolean
  onConfirm: () => void
}

export function ConfirmButton({
  label,
  confirmLabel = 'Tap again',
  disabled = false,
  onConfirm,
}: Props) {
  const [armed, setArmed] = useState(false)

  return (
    <button
      type="button"
      className={armed ? 'confirm-button confirm-button-armed' : 'confirm-button'}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
