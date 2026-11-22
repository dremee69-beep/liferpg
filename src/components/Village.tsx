// THE VILLAGE (home screen): who you are, your player level, the five realm
// cards with their log buttons, and your recent activity.

import { challengeView } from '../game/challenges.ts'
import { dailyStatuses } from '../game/dailies.ts'
import { bucketTrophies, mapTitles } from '../game/mapMilestones.ts'
import { isPairRealm, PLAYERS, REALMS } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import { playerLevel } from '../game/xp.ts'
import type { SaveData } from '../storage/save.ts'
import { ActivityLog } from './ActivityLog.tsx'
import { PartnerCard } from './PartnerCard.tsx'
import { RealmCard } from './RealmCard.tsx'
import { TogetherQuests } from './TogetherQuests.tsx'

type Props = {
  save: SaveData
  now: Date // the current time, used to decide what counts as "today"
  onLog: (realm: RealmId, xp: number) => void
  onDaily: (dailyId: string) => void
  onRemoveEntry: (index: number) => void
  onOpenHistory: () => void
  onLogParty: (questId: string) => void
  onConfirmParty: (logId: string) => void
}

// A small gold cup, drawn by us in the sticker style.
function TrophyPicture() {
  return (
    <svg width={44} height={44} viewBox="0 0 48 48" aria-hidden="true">
      <g stroke="#1e1b2e" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round">
        <path d="M14 10 C6 10 6 22 16 22 M34 10 C42 10 42 22 32 22" fill="none" />
        <path d="M13 7 H35 V16 C35 24 30 28 24 28 C18 28 13 24 13 16 Z" fill="#ffd166" />
        <path d="M24 28 V34" fill="none" />
        <rect x={15} y={34} width={18} height={7} rx={2} fill="#c0703c" />
      </g>
    </svg>
  )
}

export function Village({
  save,
  now,
  onLog,
  onDaily,
  onRemoveEntry,
  onOpenHistory,
  onLogParty,
  onConfirmParty,
}: Props) {
  // Look up the display name for the saved player id.
  const player = PLAYERS.find((p) => p.id === save.player)
  // The newest title earned on the map, and the bucket-list trophies.
  const titles = mapTitles(save)
  const title = titles.length > 0 ? titles[titles.length - 1] : undefined
  const trophies = bucketTrophies(save)

  return (
    <main className="screen village">
      <header className="village-header">
        <div>
          <p className="village-label">Village</p>
          <h1>{player?.name}</h1>
          {title !== undefined && <span className="village-title">{title}</span>}
        </div>
        <div className="player-level">
          <span className="player-level-label">Player level</span>
          <span className="player-level-number">{playerLevel(save.realmXp)}</span>
        </div>
      </header>

      {/* Shown once your partner's share code has been pasted in Camp. */}
      {save.partner !== null && <PartnerCard partner={save.partner} now={now} />}

      {/* One trophy for each bucket-list place you reached together. */}
      {trophies.length > 0 && (
        <section className="panel" data-realm="together">
          <h2>Bucket-list trophies</h2>
          <ul className="trophy-shelf">
            {trophies.map((pin) => (
              <li key={pin.id} className="trophy">
                <TrophyPicture />
                {pin.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {REALMS.map((realm) => (
        <RealmCard
          key={realm.id}
          realm={realm}
          xp={save.realmXp[realm.id]}
          dailies={dailyStatuses(save, realm.id, now)}
          challenges={save.challenges
            .filter((challenge) => challenge.realm === realm.id)
            .map((challenge) => challengeView(save, challenge, now))}
          onLog={onLog}
          onDaily={onDaily}
          // Together shows party quests in place of dailies and buttons.
          pairSection={
            isPairRealm(realm.id) ? (
              <TogetherQuests
                save={save}
                onLog={onLogParty}
                onConfirm={onConfirmParty}
              />
            ) : undefined
          }
        />
      ))}

      <ActivityLog
        save={save}
        now={now}
        onRemove={onRemoveEntry}
        onOpenHistory={onOpenHistory}
      />
    </main>
  )
}
