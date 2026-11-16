// THE PARTY QUESTS ON THE TOGETHER CARD (Village screen).
// Together has no Small / Big buttons and no solo dailies: its XP comes only
// from party quests your partner confirms. So its card shows what is waiting
// for you, and your party quests to tap. Adding, removing and cancelling
// happen in the Party quests panel on the Quests screen.

import { PARTY_QUEST_XP, PLAYERS } from '../game/rules.ts'
import type { SaveData } from '../storage/save.ts'

type Props = {
  save: SaveData
  onLog: (questId: string) => void
  onConfirm: (logId: string) => void
}

export function TogetherQuests({ save, onLog, onConfirm }: Props) {
  // The other player's name, e.g. "Deepika" on Rachit's phone.
  const partnerName =
    PLAYERS.find((p) => p.id !== save.player)?.name ?? 'your partner'

  const forMe = save.partyLogs.filter(
    (log) => log.by !== save.player && log.state === 'pending',
  )
  const waiting = save.partyLogs.filter(
    (log) => log.by === save.player && log.state === 'pending',
  )

  return (
    <div className="dailies">
      {/* Quests your partner logged: one tap confirms and pays you. */}
      {forMe.map((log) => (
        <div key={log.id} className="party-waiting party-for-me">
          <div className="activity-text">
            <span className="activity-what">{log.name}</span>
            <span className="activity-meta">{partnerName} logged this</span>
          </div>
          <button
            type="button"
            className="edit-add"
            onClick={() => onConfirm(log.id)}
          >
            Confirm +{PARTY_QUEST_XP}
          </button>
        </div>
      ))}

      {/* Your party quests: one tap logs it, then it waits for your partner. */}
      {save.partyQuests.map((quest) => (
        <button
          key={quest.id}
          type="button"
          className="daily"
          onClick={() => onLog(quest.id)}
        >
          <span className="daily-name">{quest.name}</span>
          <span className="daily-xp">Log it</span>
        </button>
      ))}

      <p className="challenge-hint">
        {waiting.length > 0
          ? `${waiting.length} waiting for ${partnerName} to confirm. Send your share code from Camp.`
          : `You both get ${PARTY_QUEST_XP} XP once ${partnerName} confirms.`}
      </p>
    </div>
  )
}
