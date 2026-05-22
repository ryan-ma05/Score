import { startTransition, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ApiError } from './lib/api'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FriendProvider } from './context/FriendContext'
import { GroupProvider } from './context/GroupContext'
import TopTabs from './components/navigation/TopTabs'
import {
  createGame,
  listGames,
} from './lib/contentApi'
import {
  sortGames,
  validateGameSubmission,
  type CreateGameInput,
  type GameDefinition,
} from './lib/content'
import Create from './pages/Create'
import Featured from './pages/Featured'
import Friends from './pages/Friends'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Search from './pages/Search'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'

type AuthPage = 'signin' | 'signup'

function AppRoutes() {
  const { user, initializing } = useAuth()
  const [authPage, setAuthPage] = useState<AuthPage>('signin')
  const [games, setGames] = useState<GameDefinition[]>([])
  const [contentLoading, setContentLoading] = useState(true)
  const [contentError, setContentError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      return
    }

    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      setContentLoading(true)
      setContentError(null)
    })

    listGames()
      .then((gameRows) => {
        if (cancelled) return
        startTransition(() => {
          setGames(sortGames(gameRows))
        })
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : 'Could not load the game library.'
        setContentError(message)
      })
      .finally(() => {
        if (!cancelled) {
          setContentLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user])

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return authPage === 'signin'
      ? <SignIn onGoToSignUp={() => setAuthPage('signup')} />
      : <SignUp onGoToSignIn={() => setAuthPage('signin')} />
  }

  async function handleCreateGame(input: CreateGameInput) {
    const validationError = validateGameSubmission(input)
    if (validationError) return validationError

    try {
      const createdGame = await createGame(input)
      handleCatalogGameCreated(createdGame)
      return null
    } catch (err) {
      return err instanceof ApiError ? err.message : 'Could not save this game right now.'
    }
  }

  function handleCatalogGameCreated(createdGame: GameDefinition) {
    setGames((current) => sortGames([createdGame, ...current.filter((game) => game.id !== createdGame.id)]))
  }

  return (
    <FriendProvider>
      <GroupProvider>
        <AuthenticatedShell
          contentError={contentError}
          contentLoading={contentLoading}
          games={games}
          onCatalogGameCreated={handleCatalogGameCreated}
          onCreateGame={handleCreateGame}
        />
      </GroupProvider>
    </FriendProvider>
  )
}

interface AuthenticatedShellProps {
  contentError: string | null
  contentLoading: boolean
  games: GameDefinition[]
  onCatalogGameCreated: (game: GameDefinition) => void
  onCreateGame: (input: CreateGameInput) => Promise<string | null>
}

function AuthenticatedShell({
  contentError,
  contentLoading,
  games,
  onCatalogGameCreated,
  onCreateGame,
}: AuthenticatedShellProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff7ed,_transparent_30%),linear-gradient(180deg,_#fffaf5_0%,_#f8fafc_45%,_#eef2ff_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[32px] border border-white/70 bg-white/90 p-5 shadow-[0_16px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-sm font-semibold uppercase tracking-[0.2em] text-white">
                  Sc
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">Score</p>
                  <h1 className="text-xl font-semibold text-gray-900">Games, groups, clips, and friends</h1>
                </div>
              </div>
              <p className="text-sm text-gray-500">Signed in as {user?.email}</p>
            </div>

            <div className="flex flex-col items-stretch gap-3 lg:items-end">
              <TopTabs />
              <button
                onClick={signOut}
                className="self-start rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 lg:self-end"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-4">
          {contentLoading && (
            <section className="rounded-[24px] border border-gray-200 bg-white px-5 py-4 text-sm text-gray-500 shadow-sm">
              Loading games…
            </section>
          )}

          {contentError && (
            <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
              {contentError}
            </section>
          )}

          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home games={games} onCatalogGameCreated={onCatalogGameCreated} />} />
            <Route path="/create" element={<Create onCreateGame={onCreateGame} recentGames={games} />} />
            <Route path="/featured" element={<Featured games={games} />} />
            <Route path="/search" element={<Search games={games} />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
