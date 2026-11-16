// THE QUEST LOG: today's dailies, your challenges, and where you add and
// edit both, and your epic quests with their milestones.

import { useState } from 'react'
import { canAddChallenge, challengeView } from '../game/challenges.ts'
import type { ChallengeInput } from '../game/challenges.ts'
import { dailyStatuses } from '../game/dailies.ts'
import { canAddEpic, epicView } from '../game/epics.ts'
import type { EpicInput } from '../game/epics.ts'
import { EPIC_MILESTONE_XP, MAX_SHIELDS, REALMS } from '../game/rules.ts'
import type { RealmId } from '../game/rules.ts'
import type { ChallengeTier, SaveData } from '../storage/save.ts'
import { ChallengeCard } from './ChallengeCard.tsx'
import { ChallengeForm } from './ChallengeForm.tsx'
import { DailyRow } from './DailyRow.tsx'
import { EditDailies } from './EditDailies.tsx'
import { EpicCard } from './EpicCard.tsx'
import { EpicForm } from './EpicForm.tsx'
import { Icon } from './Icon.tsx'

type Props = {
  save: SaveData
  now: Date
  onDaily: (dailyId: string) => void
  onAddDaily: (realm: RealmId, name: string, xp: number) => void
  onRenameDaily: (dailyId: string, name: string) => void
  onResizeDaily: (dailyId: string, xp: number) => void
  onRemoveDaily: (dailyId: string) => void
  onAddChallenge: (input: ChallengeInput) => void
  onUpdateChallenge: (
    challengeId: string,
    changes: { name: string; dailyId: string | null; tiers: ChallengeTier[] },
  ) => void
  onRemoveChallenge: (challengeId: string) => void
  onAddEpic: (input: EpicInput) => void
  onUpdateEpic: (
    epicId: string,
    changes: { name: string; openMilestones: string[] },
  ) => void
  onRemoveEpic: (epicId: string) => void
  onMilestone: (epicId: string, milestoneId: string) => void
}

export function QuestLog({
  save,
  now,
  onDaily,
  onAddDaily,
  onRenameDaily,
  onResizeDaily,
  onRemoveDaily,
  onAddChallenge,
  onUpdateChallenge,
  onRemoveChallenge,
  onAddEpic,
  onUpdateEpic,
  onRemoveEpic,
  onMilestone,
}: Props) {
  // Which epic quest form is open: none, the "new" one, or the edit form
  // for one epic (remembered by its id).
  const [epicForm, setEpicForm] = useState<'closed' | 'new' | string>('closed')
  const [editingDailies, setEditingDailies] = useState(false)
  // Which challenge form is open: none, the "new challenge" one, or the
  // edit form for one challenge (remembered by its id).
  const [challengeForm, setChallengeForm] = useState<'closed' | 'new' | string>(
    'closed',
  )

  // Work out each realm's dailies once, then count how many are done.
  const groups = REALMS.map((realm) => ({
    realm,
    dailies: dailyStatuses(save, realm.id, now),
  }))
  const total = groups.reduce((sum, group) => sum + group.dailies.length, 0)
  const done = groups.reduce(
    (sum, group) => sum + group.dailies.filter((d) => d.doneToday).length,
    0,
  )

  // Skill points across all realms.
  const skillPoints = REALMS.reduce(
    (sum, realm) => sum + save.skillPoints[realm.id],
    0,
  )

  return (
    <main className="screen quests">
      <header className="screen-header">
        <h1>Quest log</h1>
        <p className="screen-subtitle">
          {done} of {total} dailies done today
        </p>
      </header>

      {/* ----- Dailies ----- */}
      <section className="panel">
        <div className="panel-top">
          <h2>{editingDailies ? 'Edit dailies' : "Today's dailies"}</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => setEditingDailies(!editingDailies)}
          >
            {editingDailies ? 'Done' : 'Edit'}
          </button>
        </div>

        {editingDailies ? (
          <EditDailies
            save={save}
            onAdd={onAddDaily}
            onRename={onRenameDaily}
            onResize={onResizeDaily}
            onRemove={onRemoveDaily}
          />
        ) : (
          groups.map(({ realm, dailies }) => (
            <div key={realm.id} className="quest-group" data-realm={realm.id}>
              <h3 className="quest-group-name">
                <Icon name={realm.id} size={24} />
                {realm.name}
              </h3>
              {dailies.map((daily) => (
                <DailyRow key={daily.id} daily={daily} onTick={onDaily} />
              ))}
            </div>
          ))
        )}
      </section>

      {/* ----- Challenges ----- */}
      <section className="panel">
        <div className="panel-top">
          <h2>Challenges</h2>
          <span className="chips">
            <span className="points-chip shield-chip">
              <Icon name="shield" size={16} />
              {save.shields} of {MAX_SHIELDS} shields
            </span>
            <span className="points-chip">
              {skillPoints} skill {skillPoints === 1 ? 'point' : 'points'}
            </span>
          </span>
        </div>

        {save.challenges.length > 0 && (
          <p className="panel-text shield-note">
            {save.shields > 0
              ? 'A missed week uses a shield by itself, and the week still counts.'
              : 'No shields left: a missed week will have to be done again.'}{' '}
            Every week on target earns a shield.
          </p>
        )}

        {save.challenges.length === 0 && challengeForm === 'closed' && (
          <p className="panel-text">
            A challenge is a chain of tiers with a weekly target, like "3 days
            a week for 2 weeks". The app counts your days from what you log.
            Finishing a tier gives 50 XP and 1 skill point. If you miss a
            week, a shield covers it.
          </p>
        )}

        {save.challenges.map((challenge) =>
          challengeForm === challenge.id ? (
            <ChallengeForm
              key={challenge.id}
              save={save}
              existing={challenge}
              onCancel={() => setChallengeForm('closed')}
              onSave={(input) => {
                onUpdateChallenge(challenge.id, {
                  name: input.name,
                  dailyId: input.dailyId,
                  tiers: input.tiers,
                })
                setChallengeForm('closed')
              }}
            />
          ) : (
            <ChallengeCard
              key={challenge.id}
              view={challengeView(save, challenge, now)}
              onEdit={() => setChallengeForm(challenge.id)}
              onRemove={() => onRemoveChallenge(challenge.id)}
            />
          ),
        )}

        {challengeForm === 'new' && (
          <ChallengeForm
            save={save}
            onCancel={() => setChallengeForm('closed')}
            onSave={(input) => {
              onAddChallenge(input)
              setChallengeForm('closed')
            }}
          />
        )}

        {challengeForm === 'closed' && canAddChallenge(save) && (
          <button
            type="button"
            className="button button-wide"
            onClick={() => setChallengeForm('new')}
          >
            + Add a challenge
          </button>
        )}
      </section>

      {/* ----- Epic quests ----- */}
      <section className="panel">
        <h2>Epic quests</h2>

        {save.epics.length === 0 && epicForm === 'closed' && (
          <p className="panel-text">
            An epic quest is a big goal that takes months, broken into
            milestones. Tick a milestone when it is really done: each one
            gives {EPIC_MILESTONE_XP} XP.
          </p>
        )}

        {save.epics.map((epic) =>
          epicForm === epic.id ? (
            <EpicForm
              key={epic.id}
              existing={epic}
              onCancel={() => setEpicForm('closed')}
              onSave={(input) => {
                onUpdateEpic(epic.id, {
                  name: input.name,
                  openMilestones: input.milestones,
                })
                setEpicForm('closed')
              }}
            />
          ) : (
            <EpicCard
              key={epic.id}
              view={epicView(epic)}
              onTick={(milestoneId) => onMilestone(epic.id, milestoneId)}
              onEdit={() => setEpicForm(epic.id)}
              onRemove={() => onRemoveEpic(epic.id)}
            />
          ),
        )}

        {epicForm === 'new' && (
          <EpicForm
            onCancel={() => setEpicForm('closed')}
            onSave={(input) => {
              onAddEpic(input)
              setEpicForm('closed')
            }}
          />
        )}

        {epicForm === 'closed' && canAddEpic(save) && (
          <button
            type="button"
            className="button button-wide"
            onClick={() => setEpicForm('new')}
          >
            + Add an epic quest
          </button>
        )}
      </section>
    </main>
  )
}
