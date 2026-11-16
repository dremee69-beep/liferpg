// THE PARTNER CARD on the Village: your partner's levels and shields, as of
// the last share code they sent you.

import { MAX_SHIELDS, PLAYERS, REALMS } from '../game/rules.ts'
import type { PartnerSummary } from '../game/share.ts'
import { levelForXp, playerLevel } from '../game/xp.ts'
import { Icon } from './Icon.tsx'
import { describeAge } from './SharePanel.tsx'

type Props = {
  partner: PartnerSummary
  now: Date
}

export function PartnerCard({ partner, now }: Props) {
  const name = PLAYERS.find((p) => p.id === partner.player)?.name ?? 'Partner'

  return (
    <section className="partner">
      <div className="partner-top">
        <div>
          <p className="village-label">Your partner</p>
          <h2>{name}</h2>
        </div>
        <span className="realm-level">Player Lv {playerLevel(partner.realmXp)}</span>
      </div>

      {/* One small chip per realm: its icon and level. */}
      <ul className="partner-realms">
        {REALMS.map((realm) => (
          <li
            key={realm.id}
            className="partner-realm"
            data-realm={realm.id}
            // Read out as e.g. "Health level 3" by screen readers.
            aria-label={`${realm.name} level ${levelForXp(partner.realmXp[realm.id])}`}
          >
            <Icon name={realm.id} size={20} />
            <span aria-hidden="true">{levelForXp(partner.realmXp[realm.id])}</span>
          </li>
        ))}
      </ul>

      <p className="partner-meta">
        <span className="partner-shields">
          <Icon name="shield" size={16} />
          {partner.shields} of {MAX_SHIELDS} shields
        </span>
        <span>From their code {describeAge(partner.at, now)}</span>
      </p>
    </section>
  )
}
