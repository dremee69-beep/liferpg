// THE VILLAGE (home screen): who you are, your player level, the five realm
// cards with their log buttons, and your recent activity.

import { challengeView } from '../game/challenges.ts'
import { dailyStatuses } from '../game/dailies.ts'
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

  return (
    <main className="screen village">
      <header className="village-header">
        <div>
          <p className="village-label">Village</p>
          <h1>{player?.name}</h1>
        </div>
        <div className="player-level">
          <span className="player-level-label">Player level</span>
          <span className="player-level-number">{playerLevel(save.realmXp)}</span>
        </div>
      </header>

      {/* Shown once your partner's share code has been pasted in Camp. */}
      {save.partner !== null && <PartnerCard partner={save.partner} now={now} />}

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
