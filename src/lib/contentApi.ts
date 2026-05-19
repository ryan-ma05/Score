import { apiFetch } from './api'
import type {
  CreateClipInput,
  CreateGameInput,
  FeaturedClip,
  GameDefinition,
} from './content'

interface GameRow {
  id: number
  name: string
  category: string
  specific_game: string
  player_count: string
  round_count: string
  scoring_system: string
  rules: string
  source: 'official' | 'community'
  moderation_status: 'approved' | 'pending' | 'rejected'
  created_by_name: string | null
  created_at: number
}

interface ClipRow {
  id: number
  game_id: number
  group_id: number | null
  title: string
  description: string
  video_url: string
  tags: string[]
  likes: number
  created_at: number
  uploaded_by_name: string | null
  game_name: string
  specific_game: string
  group_name: string | null
}

export async function listGames(params?: { q?: string; category?: string }) {
  const search = new URLSearchParams()

  if (params?.q?.trim()) search.set('q', params.q.trim())
  if (params?.category?.trim() && params.category !== 'All') search.set('category', params.category.trim())

  const suffix = search.size > 0 ? `?${search.toString()}` : ''
  const res = await apiFetch<{ games: GameRow[] }>(`/api/games${suffix}`)
  return res.games.map(mapGame)
}

export async function createGame(input: CreateGameInput) {
  const res = await apiFetch<{ game: GameRow }>('/api/games', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return mapGame(res.game)
}

export async function listFeaturedClips(params?: {
  q?: string
  gameId?: number | null
  groupId?: number | null
  sort?: 'likes' | 'recent'
}) {
  const search = new URLSearchParams()

  if (params?.q?.trim()) search.set('q', params.q.trim())
  if (params?.gameId) search.set('gameId', String(params.gameId))
  if (params?.groupId) search.set('groupId', String(params.groupId))
  if (params?.sort) search.set('sort', params.sort)

  const suffix = search.size > 0 ? `?${search.toString()}` : ''
  const res = await apiFetch<{ clips: ClipRow[] }>(`/api/featured-clips${suffix}`)
  return res.clips.map(mapClip)
}

export async function createFeaturedClip(input: CreateClipInput) {
  const res = await apiFetch<{ clip: ClipRow }>('/api/featured-clips', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      gameId: input.gameId,
      groupId: input.groupId,
      tags: input.tags,
      description: input.description,
      videoUrl: input.videoUrl,
    }),
  })

  return mapClip(res.clip)
}

function mapGame(row: GameRow): GameDefinition {
  return {
    id: row.id,
    name: row.name,
    playerCount: row.player_count,
    roundCount: row.round_count,
    scoringSystem: row.scoring_system,
    rules: row.rules,
    category: row.category,
    specificGame: row.specific_game,
    createdAt: toMilliseconds(row.created_at),
    createdBy: row.created_by_name ?? 'Score',
    source: row.source,
    moderationStatus: row.moderation_status,
  }
}

function mapClip(row: ClipRow): FeaturedClip {
  return {
    id: row.id,
    title: row.title,
    gameId: row.game_id,
    gameName: row.specific_game || row.game_name,
    groupId: row.group_id,
    groupName: row.group_name,
    tags: row.tags,
    likes: row.likes,
    uploadedAt: toMilliseconds(row.created_at),
    uploader: row.uploaded_by_name ?? 'Score',
    description: row.description,
    videoUrl: row.video_url,
  }
}

function toMilliseconds(value: number) {
  return value > 1e12 ? value : value * 1000
}
