// THE CHALLENGE FORM: used both to add a new challenge and to edit one.
// You pick a realm, a name, what counts as an active day, and the tiers.
// When editing, tiers that are already finished are shown but locked.

import { useState } from 'react'
import type { ChallengeInput } from '../game/challenges.ts'
import {
  EXAMPLE_CHALLENGE,
  isPairRealm,
  MAX_CHALLENGE_NAME_LENGTH,
  MAX_TIER_WEEKS,
  MAX_TIERS,
  REALMS,
} from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import type { Challenge, ChallengeTier, SaveData } from '../storage/save.ts'

type Props = {
  save: SaveData
  existing?: Challenge // given when editing; left out when adding
  onSave: (input: ChallengeInput) => void
  onCancel: () => void
}

// The numbers offered in the two drop-downs.
const DAY_CHOICES = [1, 2, 3, 4, 5, 6, 7]
const WEEK_CHOICES = Array.from({ length: MAX_TIER_WEEKS }, (_, i) => i + 1)

export function ChallengeForm({ save, existing, onSave, onCancel }: Props) {
  // Finished tiers cannot be changed; the rest can.
  const lockedTiers = existing ? existing.tiers.slice(0, existing.tierIndex) : []

  const [realm, setRealm] = useState<RealmId>(existing?.realm ?? 'health')
  const [name, setName] = useState(existing?.name ?? '')
  // '' means "anything logged in this realm"; otherwise it is a daily's id.
  const [dailyId, setDailyId] = useState(existing?.dailyId ?? '')
  const [tiers, setTiers] = useState<ChallengeTier[]>(
    existing
      ? existing.tiers.slice(existing.tierIndex)
      : [{ name: '', daysPerWeek: 3, weeks: 2 }],
  )

  const realmDailies = save.dailies.filter((daily) => daily.realm === realm)
  const totalTiers = lockedTiers.length + tiers.length
  const canSave = name.trim() !== '' && totalTiers > 0

  // Change one field of one tier, e.g. tier 2's days per week.
  function changeTier(index: number, change: Partial<ChallengeTier>) {
    setTiers(tiers.map((tier, i) => (i === index ? { ...tier, ...change } : tier)))
  }

  // A new tier starts as a slightly harder copy of the one before it.
  function addTier() {
    const last = tiers[tiers.length - 1] ?? lockedTiers[lockedTiers.length - 1]
    setTiers([
      ...tiers,
      {
        name: '',
        daysPerWeek: Math.min(7, (last?.daysPerWeek ?? 2) + 1),
        weeks: last?.weeks ?? 2,
      },
    ])
  }

  // Fill the form with the example from the rulebook.
  function fillExample() {
    setRealm(EXAMPLE_CHALLENGE.realm)
    setName(EXAMPLE_CHALLENGE.name)
    setDailyId('')
    setTiers(EXAMPLE_CHALLENGE.tiers.map((tier) => ({ ...tier })))
  }

  return (
    <form
      className="challenge-form"
      data-realm={realm}
      onSubmit={(event) => {
        event.preventDefault() // stop the browser from reloading the page
        if (!canSave) return
        onSave({
          realm,
          name,
          dailyId: dailyId === '' ? null : dailyId,
          tiers: [...lockedTiers, ...tiers],
        })
      }}
    >
      {!existing && (
        <button type="button" className="link-button" onClick={fillExample}>
          Fill in the rulebook example (Movement)
        </button>
      )}

      <label className="field">
        <span className="field-label">Realm</span>
        <select
          className="edit-select"
          value={realm}
          // The realm of an existing challenge cannot be changed.
          disabled={existing !== undefined}
          onChange={(event) => {
            setRealm(event.target.value as RealmId)
            setDailyId('') // the old realm's daily no longer applies
          }}
        >
          {REALMS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Challenge name</span>
        <input
          className="edit-input"
          type="text"
          value={name}
          maxLength={MAX_CHALLENGE_NAME_LENGTH}
          placeholder="e.g. Movement"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">A day counts when you log</span>
        <select
          className="edit-select"
          value={dailyId}
          onChange={(event) => setDailyId(event.target.value)}
        >
          <option value="">
            {/* Together only earns XP through party quests. */}
            {isPairRealm(realm) ? 'Any confirmed party quest' : 'Anything in this realm'}
          </option>
          {realmDailies.map((daily) => (
            <option key={daily.id} value={daily.id}>
              Only: {daily.name}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label">Tiers, in order</span>

        {lockedTiers.map((tier, index) => (
          <p key={index} className="tier-locked">
            ✓ Tier {index + 1}: {tier.name} (finished)
          </p>
        ))}

        {tiers.map((tier, index) => {
          const number = lockedTiers.length + index + 1
          return (
            <div key={index} className="tier-edit">
              <div className="tier-edit-top">
                <span className="tier-number">Tier {number}</span>
                <button
                  type="button"
                  className="tier-remove"
                  aria-label={`Remove tier ${number}`}
                  onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
                >
                  Remove tier
                </button>
              </div>
              <input
                className="edit-input"
                type="text"
                value={tier.name}
                maxLength={MAX_CHALLENGE_NAME_LENGTH}
                placeholder={`Tier ${number} name (optional)`}
                aria-label={`Name of tier ${number}`}
                onChange={(event) => changeTier(index, { name: event.target.value })}
              />
              <div className="tier-numbers">
                <select
                  className="edit-select"
                  value={tier.daysPerWeek}
                  aria-label={`Days a week for tier ${number}`}
                  onChange={(event) =>
                    changeTier(index, { daysPerWeek: Number(event.target.value) })
                  }
                >
                  {DAY_CHOICES.map((days) => (
                    <option key={days} value={days}>
                      {days} {days === 1 ? 'day' : 'days'} a week
                    </option>
                  ))}
                </select>
                <select
                  className="edit-select"
                  value={tier.weeks}
                  aria-label={`Number of weeks for tier ${number}`}
                  onChange={(event) =>
                    changeTier(index, { weeks: Number(event.target.value) })
                  }
                >
                  {WEEK_CHOICES.map((weeks) => (
                    <option key={weeks} value={weeks}>
                      for {weeks} {weeks === 1 ? 'week' : 'weeks'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}

        {totalTiers < MAX_TIERS && (
          <button type="button" className="link-button" onClick={addTier}>
            + Add a tier
          </button>
        )}
      </div>

      <div className="button-row">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button-strong" disabled={!canSave}>
          {existing ? 'Save changes' : 'Start challenge'}
        </button>
      </div>
    </form>
  )
}
