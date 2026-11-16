// PARTY QUESTS on the Quest log: things you do as a pair.
// Tap one to log it; it then waits for your partner to confirm, which
// happens through share codes (sent from Camp). Once confirmed, you both
// get Together XP.

import { useState } from 'react'
import { canAddPartyQuest } from '../game/party.ts'
import {
  MAX_PARTY_QUEST_NAME_LENGTH,
  PARTY_QUEST_XP,
  PLAYERS,
} from '../game/rules.ts'
import type { PartyLog, SaveData } from '../storage/save.ts'
import { ConfirmButton } from './ConfirmButton.tsx'
import { describeAge } from './SharePanel.tsx'

type Props = {
  save: SaveData
  now: Date
  onLog: (questId: string) => void
  onConfirm: (logId: string) => void
  onDecline: (logId: string) => void
  onCancel: (logId: string) => void
  onAdd: (name: string) => void
  onRemove: (questId: string) => void
}

export function PartyPanel({
  save,
  now,
  onLog,
  onConfirm,
  onDecline,
  onCancel,
  onAdd,
  onRemove,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState('')

  // The other player's name, e.g. "Deepika" on Rachit's phone.
  const partnerName =
    PLAYERS.find((p) => p.id !== save.player)?.name ?? 'your partner'

  // Sort what has been logged into the three lists the panel shows.
  const mine = (log: PartyLog) => log.by === save.player
  const forMe = save.partyLogs.filter((l) => !mine(l) && l.state === 'pending')
  const waiting = save.partyLogs.filter((l) => mine(l) && l.state === 'pending')
  const declined = save.partyLogs.filter((l) => mine(l) && l.state === 'declined')

  return (
    <section className="panel" data-realm="together">
      <div className="panel-top">
        <h2>{editing ? 'Edit party quests' : 'Party quests'}</h2>
        <button
          type="button"
          className="link-button"
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {editing ? (
        // ----- Editing the list -----
        <div className="edit-dailies">
          {save.partyQuests.map((quest) => (
            <div key={quest.id} className="party-edit-row">
              <span className="daily-name">{quest.name}</span>
              <ConfirmButton
                label="Remove"
                // Always keep at least one party quest.
                disabled={save.partyQuests.length <= 1}
                onConfirm={() => onRemove(quest.id)}
              />
            </div>
          ))}

          {canAddPartyQuest(save) && (
            <form
              className="edit-daily edit-daily-new"
              onSubmit={(event) => {
                event.preventDefault() // stop the browser reloading the page
                if (newName.trim() === '') return
                onAdd(newName)
                setNewName('')
              }}
            >
              <input
                className="edit-input"
                type="text"
                value={newName}
                maxLength={MAX_PARTY_QUEST_NAME_LENGTH}
                placeholder="New party quest"
                aria-label="Name of the new party quest"
                onChange={(event) => setNewName(event.target.value)}
              />
              <div className="edit-controls">
                <span className="challenge-hint">
                  Worth {PARTY_QUEST_XP} Together XP each
                </span>
                <button
                  type="submit"
                  className="edit-add"
                  disabled={newName.trim() === ''}
                >
                  Add
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <>
          <p className="panel-text">
            Did one together? Tap it. You both get {PARTY_QUEST_XP} Together
            XP once {partnerName} confirms it.
          </p>

          {/* ----- Quests your partner logged, waiting for you ----- */}
          {forMe.length > 0 && (
            <div className="party-group">
              <h3 className="quest-group-name">Waiting for you</h3>
              {forMe.map((log) => (
                <div key={log.id} className="party-waiting party-for-me">
                  <div className="activity-text">
                    <span className="activity-what">{log.name}</span>
                    <span className="activity-meta">
                      {partnerName} logged this {describeAge(log.at, now)}
                    </span>
                  </div>
                  <div className="party-buttons">
                    <ConfirmButton
                      label="Decline"
                      onConfirm={() => onDecline(log.id)}
                    />
                    <button
                      type="button"
                      className="edit-add"
                      onClick={() => onConfirm(log.id)}
                    >
                      Confirm +{PARTY_QUEST_XP}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ----- The list: tap to log ----- */}
          <div className="quest-group">
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
          </div>

          {/* ----- Quests you logged, waiting for your partner ----- */}
          {waiting.length > 0 && (
            <div className="party-group">
              <h3 className="quest-group-name">Waiting for {partnerName}</h3>
              {waiting.map((log) => (
                <div key={log.id} className="party-waiting">
                  <div className="activity-text">
                    <span className="activity-what">{log.name}</span>
                    <span className="activity-meta">
                      Logged {describeAge(log.at, now)}
                    </span>
                  </div>
                  <ConfirmButton label="Cancel" onConfirm={() => onCancel(log.id)} />
                </div>
              ))}
              <p className="challenge-hint">
                Send your share code from Camp so {partnerName} can confirm.
              </p>
            </div>
          )}

          {/* ----- Quests your partner said no to ----- */}
          {declined.length > 0 && (
            <div className="party-group">
              <h3 className="quest-group-name">Declined by {partnerName}</h3>
              {declined.map((log) => (
                <div key={log.id} className="party-waiting">
                  <div className="activity-text">
                    <span className="activity-what">{log.name}</span>
                    <span className="activity-meta">
                      Logged {describeAge(log.at, now)}
                    </span>
                  </div>
                  <ConfirmButton label="Clear" onConfirm={() => onCancel(log.id)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
