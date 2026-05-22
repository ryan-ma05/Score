import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CreateClipInput, FeaturedClip, GameDefinition } from '../lib/content'
import { validateClipSubmission } from '../lib/content'
import { createFeaturedClip, listFeaturedClips, uploadVideo } from '../lib/contentApi'

interface Props {
  games: GameDefinition[]
}

const EMPTY_FORM: CreateClipInput = {
  title: '',
  gameId: null,
  groupId: null,
  tags: '',
  description: '',
  videoUrl: '',
}

const PAGE_SIZE = 20

type SortMode = 'likes' | 'recent'

export default function Featured({ games }: Props) {
  const [form, setForm] = useState<CreateClipInput>(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [gameFilter, setGameFilter] = useState('All games')
  const [sortMode, setSortMode] = useState<SortMode>('likes')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [clips, setClips] = useState<FeaturedClip[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loadingClips, setLoadingClips] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingClips(true)
    listFeaturedClips({ limit: PAGE_SIZE, offset: 0 })
      .then(({ clips: rows, hasMore: more }) => {
        if (cancelled) return
        setClips(rows)
        setHasMore(more)
        setOffset(PAGE_SIZE)
      })
      .finally(() => {
        if (!cancelled) setLoadingClips(false)
      })
    return () => { cancelled = true }
  }, [])

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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    if (!file) {
      updateField('videoUrl', '')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const url = await uploadVideo(file)
      updateField('videoUrl', url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setSelectedFile(null)
      updateField('videoUrl', '')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validateClipSubmission(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const createdClip = await createFeaturedClip(form)
      setClips((current) => [createdClip, ...current.filter((c) => c.id !== createdClip.id)])
      setForm(EMPTY_FORM)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess('Clip saved to the shared featured feed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this clip right now.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      const { clips: rows, hasMore: more } = await listFeaturedClips({ limit: PAGE_SIZE, offset })
      setClips((current) => {
        const seen = new Set(current.map((c) => c.id))
        return [...current, ...rows.filter((r) => !seen.has(r.id))]
      })
      setHasMore(more)
      setOffset((prev) => prev + PAGE_SIZE)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
      <aside className="space-y-6">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-600">Featured</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">Highlight the best clips</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Upload a video clip and tag it to a game. Files are stored on the server. For production,
            swap the storage backend to S3 or Cloudflare R2 without changing any other code.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Clip title</span>
              <input
                required
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Enter a clip title"
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
              {games.length === 0 && (
                <p className="text-sm text-amber-700">Create a game before adding a featured clip.</p>
              )}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Tags</span>
              <input
                required
                value={form.tags}
                onChange={(event) => updateField('tags', event.target.value)}
                placeholder="Add clip tags"
                className={inputClassName}
              />
            </label>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-gray-700">Video file</span>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 transition hover:border-amber-400 hover:bg-amber-50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  required={!form.videoUrl}
                  className="sr-only"
                  onChange={handleFileChange}
                />
                {uploading ? (
                  <span className="text-amber-600">Uploading…</span>
                ) : selectedFile ? (
                  <span className="truncate text-center font-medium text-gray-700">{selectedFile.name}</span>
                ) : (
                  <span>Click to choose a video file</span>
                )}
                <span className="text-xs text-gray-400">MP4, WebM, MOV up to 500 MB</span>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">Description</span>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Describe the clip"
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
              disabled={submitting || uploading || games.length === 0}
              className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Add featured clip'}
            </button>
          </form>
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
                placeholder="Search clips"
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

        {loadingClips ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          </div>
        ) : filteredClips.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No featured clips have been added yet.
          </section>
        ) : (
          <>
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

            {hasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
