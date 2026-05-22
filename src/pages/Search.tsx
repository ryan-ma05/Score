import { useDeferredValue, useState } from 'react'
import { GAME_CATEGORIES, type GameDefinition } from '../lib/content'

interface Props {
  games: GameDefinition[]
}

export default function Search({ games }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const deferredQuery = useDeferredValue(query)

  const filteredGames = games.filter((game) => {
    const matchesQuery =
      deferredQuery.trim().length === 0
      || [game.name, game.specificGame, game.category, game.scoringSystem, game.rules]
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery.trim().toLowerCase())

    const matchesCategory = category === 'All' || game.category === category
    return matchesQuery && matchesCategory
  })

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-600">Search</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Explore saved games</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Browse the saved catalog and anything your community adds from the Create tab.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Search games</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, category, or rules"
                className={inputClassName}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={inputClassName}
              >
                <option value="All">All</option>
                {GAME_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredGames.map((game) => (
          <article key={game.id} className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{game.category}</p>
                <h2 className="mt-2 text-lg font-semibold text-gray-900">{game.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{game.specificGame}</p>
              </div>
              <span
                className={[
                  'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                  game.source === 'official'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-amber-50 text-amber-700',
                ].join(' ')}
              >
                {game.source === 'official' ? 'Official' : 'Community'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-gray-500">
              <span className="rounded-full bg-gray-100 px-3 py-1">{game.playerCount} players</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">{game.roundCount}</span>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-600">{game.rules}</p>

            <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Scoring</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{game.scoringSystem}</p>
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-gray-400">
              Added by {game.createdBy}
            </p>
          </article>
        ))}
      </section>

      {filteredGames.length === 0 && (
        <section className="rounded-[24px] border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No games matched this search yet. Create one or widen the filters.
        </section>
      )}
    </div>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
