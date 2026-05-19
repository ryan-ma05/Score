import { useState, type FormEvent } from 'react'
import type { CreateClipInput, FeaturedClip, GameDefinition } from '../lib/content'

interface Props {
  clips: FeaturedClip[]
  games: GameDefinition[]
  onCreateClip: (input: CreateClipInput) => Promise<string | null>
}

const EMPTY_FORM: CreateClipInput = {
  title: '',
  gameId: null,
  groupId: null,
  tags: '',
  description: '',
  videoUrl: '',
}

type SortMode = 'likes' | 'recent'

export default function Featured({ clips, games, onCreateClip }: Props) {
  const [form, setForm] = useState<CreateClipInput>(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [gameFilter, setGameFilter] = useState('All games')
  const [sortMode, setSortMode] = useState<SortMode>('likes')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const gameOptions = Array.from(new Set(games.map((game) => game.specificGame))).sort()

  const filteredClips = [...clips]
    .filter((clip) => {
      const text = [clip.title, clip.gameName, clip.tags.join(' '), clip.description].join(' ').toLowerCase()
      const matchesQuery = query.trim().length === 0 || text.includes(query.trim().toLowerCase())
      const matchesGame = gameFilter === 'All games' || clip.gameName === gameFilter
      return matchesQuery && matchesGame
    })
    .sort((a, b) => {
      if (sortMode === 'recent') return b.uploadedAt - a.uploadedAt
      return b.likes - a.likes || b.uploadedAt - a.uploadedAt
    })

  function updateField<K extends keyof CreateClipInput>(key: K, value: CreateClipInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    try {
      const result = await onCreateClip(form)
      if (result) {
        setError(result)
        return
      }

      setForm(EMPTY_FORM)
      setSuccess('Clip saved to the shared featured feed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
      <aside className="space-y-6">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-600">Featured</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">Highlight the best clips</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            This feed currently tracks clip metadata and tags. For real uploads later, we should
            add object storage plus moderation on both the video itself and its metadata.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Clip title</span>
              <input
                required
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Final shot from the championship table"
                className={inputClassName}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Game tag</span>
              <select
                required
                value={form.gameId == null ? '' : String(form.gameId)}
                onChange={(event) => updateField('gameId', event.target.value ? Number(event.target.value) : null)}
                className={inputClassName}
              >
                <option value="">Select a game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.specificGame} • {game.category}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Tags</span>
              <input
                required
                value={form.tags}
                onChange={(event) => updateField('tags', event.target.value)}
                placeholder="featured, clutch, party"
                className={inputClassName}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Video URL</span>
              <input
                required
                value={form.videoUrl}
                onChange={(event) => updateField('videoUrl', event.target.value)}
                placeholder="https://..."
                className={inputClassName}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Description</span>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Add context so people know what makes this clip worth watching."
                className={`${inputClassName} resize-none`}
              />
            </label>

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

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              {submitting ? 'Saving…' : 'Add featured clip'}
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Suggested next step</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            If you want true uploads, a clean MVP is: file upload to storage, thumbnail generation,
            metadata row in the database, then moderation and feed ranking on the backend.
          </p>
        </section>
      </aside>

      <section className="space-y-6">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_220px_180px]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Search clips</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, tags, or games"
                className={inputClassName}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Game filter</span>
              <select
                value={gameFilter}
                onChange={(event) => setGameFilter(event.target.value)}
                className={inputClassName}
              >
                <option value="All games">All games</option>
                {gameOptions.map((game) => (
                  <option key={game} value={game}>
                    {game}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Sort by</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className={inputClassName}
              >
                <option value="likes">Likes</option>
                <option value="recent">Most recent</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredClips.map((clip) => (
            <article key={clip.id} className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      {clip.gameName}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-gray-900">{clip.title}</h2>
                    {clip.groupName && (
                      <p className="mt-1 text-sm text-gray-500">From {clip.groupName}</p>
                    )}
                  </div>

                  <p className="text-sm leading-6 text-gray-600">{clip.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {clip.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-w-[200px] rounded-[22px] bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Likes</span>
                    <span className="font-semibold text-gray-900">{clip.likes}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Uploader</span>
                    <span className="font-medium text-gray-900">{clip.uploader}</span>
                  </div>
                  <a
                    href={clip.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white"
                  >
                    Open clip
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
