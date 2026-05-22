import { useState, type FormEvent, type ReactNode } from 'react'
import {
  GAME_CATEGORIES,
  type CreateGameInput,
  type GameDefinition,
} from '../lib/content'

interface Props {
  onCreateGame: (input: CreateGameInput) => Promise<string | null>
  recentGames: GameDefinition[]
}

const EMPTY_FORM: CreateGameInput = {
  name: '',
  playerCount: '',
  roundCount: '',
  scoringSystem: '',
  rules: '',
  category: GAME_CATEGORIES[0],
  specificGame: '',
}

export default function Create({ onCreateGame, recentGames }: Props) {
  const [form, setForm] = useState<CreateGameInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  function updateField<K extends keyof CreateGameInput>(key: K, value: CreateGameInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      const result = await onCreateGame(form)
      if (result) {
        setError(result)
        return
      }

      setForm(EMPTY_FORM)
      setSuccess('Game saved to the shared catalog. It is now available from Search.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-600">Create</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">Add a game to the catalog</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            This MVP sends approved submissions directly into the in-app search catalog. Right now
            the appropriateness filter is a lightweight frontend gate, so we should replace it with
            backend moderation before launch.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Game name">
              <input
                required
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Enter a game name"
                className={inputClassName}
              />
            </Field>

            <Field label="Category">
              <select
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
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
                required
                value={form.specificGame}
                onChange={(event) => updateField('specificGame', event.target.value)}
                placeholder="Enter the specific game"
                className={inputClassName}
              />
            </Field>

            <Field label="Players">
              <input
                required
                value={form.playerCount}
                onChange={(event) => updateField('playerCount', event.target.value)}
                placeholder="Enter the player count"
                className={inputClassName}
              />
            </Field>

            <Field label="Rounds">
              <input
                required
                value={form.roundCount}
                onChange={(event) => updateField('roundCount', event.target.value)}
                placeholder="Enter the round format"
                className={inputClassName}
              />
            </Field>
          </div>

          <Field label="Scoring system">
            <textarea
              required
              rows={3}
              value={form.scoringSystem}
              onChange={(event) => updateField('scoringSystem', event.target.value)}
              placeholder="Describe how scoring works"
              className={`${inputClassName} resize-none`}
            />
          </Field>

          <Field label="Rules">
            <textarea
              required
              rows={7}
              value={form.rules}
              onChange={(event) => updateField('rules', event.target.value)}
              placeholder="Add the rules for this game"
              className={`${inputClassName} resize-none`}
            />
          </Field>

          <p className="text-sm text-gray-500">
            Rules are still stored as freeform text today, but the target structure is: setup, turn
            flow, scoring, win condition, and safety notes.
          </p>

          {error && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              {submitting ? 'Saving…' : 'Submit game'}
            </button>
            <span className="rounded-full border border-gray-200 px-4 py-2.5 text-sm text-gray-500">
              Next step: move moderation into the backend before public launch.
            </span>
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Suggested product tweaks</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
            <li>Separate “game template” from “specific session” so one game can power many group events.</li>
            <li>Use a structured rules format later: setup, turn flow, scoring, win condition, safety notes.</li>
            <li>Decide whether “players” should be a fixed number, a range, or an optional min/max pair.</li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Recently added games</h2>
          {recentGames.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              No games have been added yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentGames.slice(0, 4).map((game) => (
                <div key={game.id} className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-900">{game.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {game.specificGame} • {game.category}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-400">
                    {game.playerCount} players • {game.roundCount}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">{game.scoringSystem}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
