export interface GameDefinition {
  id: number
  name: string
  playerCount: string
  roundCount: string
  scoringSystem: string
  rules: string
  category: string
  specificGame: string
  createdAt: number
  createdBy: string
  source: 'official' | 'community'
  moderationStatus: 'approved' | 'pending' | 'rejected'
}

export interface CreateGameInput {
  name: string
  playerCount: string
  roundCount: string
  scoringSystem: string
  rules: string
  category: string
  specificGame: string
}

export interface FeaturedClip {
  id: number
  title: string
  gameId: number
  gameName: string
  groupId: number | null
  groupName: string | null
  tags: string[]
  likes: number
  uploadedAt: number
  uploader: string
  description: string
  videoUrl: string
}

export interface CreateClipInput {
  title: string
  gameId: number | null
  groupId: number | null
  tags: string
  description: string
  videoUrl: string
}

export const GAME_CATEGORIES = [
  'Card game',
  'Drinking game',
  'Sports',
  'Party game',
  'Board game',
  'Strategy',
] as const

export function sortGames(games: GameDefinition[]) {
  return [...games].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'official' ? -1 : 1
    return b.createdAt - a.createdAt
  })
}

export function sortClips(clips: FeaturedClip[]) {
  return [...clips].sort((a, b) => b.likes - a.likes || b.uploadedAt - a.uploadedAt)
}

export function validateGameSubmission(input: CreateGameInput) {
  const fields = [
    input.name,
    input.playerCount,
    input.roundCount,
    input.scoringSystem,
    input.rules,
    input.category,
    input.specificGame,
  ]

  if (fields.some((field) => !field.trim())) {
    return 'Complete every field before submitting a game.'
  }

  if (input.scoringSystem.trim().length < 10) {
    return 'Add a clear scoring system so groups know how to track points.'
  }

  if (input.rules.trim().length < 24) {
    return 'Add a little more detail to the rules so people can actually play the game.'
  }

  return null
}

export function validateClipSubmission(input: CreateClipInput) {
  const gameId = input.gameId

  if (!gameId) {
    return 'Choose a saved game before adding a clip.'
  }

  if ([input.title, input.tags, input.description, input.videoUrl].some((field) => !field.trim())) {
    return 'Complete every clip field before adding it to the feed.'
  }

  if (!/^https?:\/\//i.test(input.videoUrl.trim())) {
    return 'Use a full video URL so clips have a portable destination.'
  }

  return null
}
