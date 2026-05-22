import type { FormEvent } from 'react'
import type { Group, SavedGroupGame } from '../../../context/GroupContext'
import { inputClassName } from '../groupDetailUtils'
import type { CreateGameInput, GameDefinition } from '../../../lib/content'
import { GAME_CATEGORIES } from '../../../lib/content'
import { DetailBlock, EmptyState, Field, Panel } from './shared'

interface Props {
  group: Group
  savedGames: SavedGroupGame[]
  unsavedCatalogGames: GameDefinition[]
  selectedCatalogGameId: number | null
  templateForm: CreateGameInput
  savingCatalogTemplate: boolean
  creatingTemplate: boolean
  onSelectCatalogGame: (id: number | null) => void
  onSaveTemplate: () => void
  onUpdateTemplateField: <K extends keyof CreateGameInput>(key: K, value: CreateGameInput[K]) => void
  onCreateTemplate: (event: FormEvent<HTMLFormElement>) => void
  onRemoveTemplate: (gameId: number) => void
}

export default function GroupGamesPanel({
  savedGames,
  unsavedCatalogGames,
  selectedCatalogGameId,
  templateForm,
  savingCatalogTemplate,
  creatingTemplate,
  onSelectCatalogGame,
  onSaveTemplate,
  onUpdateTemplateField,
  onCreateTemplate,
  onRemoveTemplate,
}: Props) {
  return (
    <Panel
      title="Game templates"
      subtitle="Keep reusable games visible and separate from the one-off session details that sit below."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[26px] border border-slate-200 bg-slate-50/85 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Add from shared catalog</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Official and community-approved games stay reusable across every group.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <select
              value={selectedCatalogGameId ?? ''}
              onChange={(event) => onSelectCatalogGame(Number(event.target.value) || null)}
              className={inputClassName}
            >
              <option value="">Choose from the main catalog…</option>
              {unsavedCatalogGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.specificGame} • {game.category}
                </option>
              ))}
            </select>
            <button
              onClick={onSaveTemplate}
              disabled={!selectedCatalogGameId || savingCatalogTemplate}
              className="rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingCatalogTemplate ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>

        <form onSubmit={onCreateTemplate} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Create a custom template</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                This publishes the game to Search and saves it to this group after the standard
                appropriateness check.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              New
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Game name">
              <input
                value={templateForm.name}
                onChange={(event) => onUpdateTemplateField('name', event.target.value)}
                placeholder="Enter a template name"
                className={inputClassName}
              />
            </Field>

            <Field label="Category">
              <select
                value={templateForm.category}
                onChange={(event) => onUpdateTemplateField('category', event.target.value)}
                className={inputClassName}
              >
                {GAME_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Specific game">
              <input
                value={templateForm.specificGame}
                onChange={(event) => onUpdateTemplateField('specificGame', event.target.value)}
                placeholder="Enter the specific game"
                className={inputClassName}
              />
            </Field>

            <Field label="Players">
              <input
                value={templateForm.playerCount}
                onChange={(event) => onUpdateTemplateField('playerCount', event.target.value)}
                placeholder="Enter the player count"
                className={inputClassName}
              />
            </Field>

            <Field label="Rounds">
              <input
                value={templateForm.roundCount}
                onChange={(event) => onUpdateTemplateField('roundCount', event.target.value)}
                placeholder="Enter the round format"
                className={inputClassName}
              />
            </Field>
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Scoring system">
              <textarea
                rows={3}
                value={templateForm.scoringSystem}
                onChange={(event) => onUpdateTemplateField('scoringSystem', event.target.value)}
                placeholder="Describe how scoring works"
                className={`${inputClassName} resize-none`}
              />
            </Field>

            <Field label="Rules">
              <textarea
                rows={6}
                value={templateForm.rules}
                onChange={(event) => onUpdateTemplateField('rules', event.target.value)}
                placeholder="Add the rules for this template"
                className={`${inputClassName} resize-none`}
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={creatingTemplate}
              className="rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingTemplate ? 'Creating…' : 'Create and save template'}
            </button>
            <span className="text-sm text-slate-500">
              Templates stay reusable. Sessions can still override the rules later.
            </span>
          </div>
        </form>
      </div>

      <div className="mt-5 space-y-3">
        {savedGames.length === 0 ? (
          <EmptyState message="No game templates saved yet. Save one from the shared catalog or create a new one here." />
        ) : (
          savedGames.map((savedGame) => (
            <article
              key={savedGame.gameId}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{savedGame.specificGame}</h3>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                      Template
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {savedGame.category} • {savedGame.playerCount} players • {savedGame.roundCount}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailBlock label="Scoring system" value={savedGame.scoringSystem} />
                    <DetailBlock label="Rules" value={savedGame.rules} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-gray-400">
                    Saved by {savedGame.savedByName ?? 'a teammate'}
                  </p>
                </div>

                <button
                  onClick={() => onRemoveTemplate(savedGame.gameId)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Remove template
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </Panel>
  )
}
