import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { apiFetch, ApiError } from '../lib/api'

interface User {
  id: number
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setInitializing(false)
      return
    }
    apiFetch<{ user: User }>('/api/auth/me')
      .then(({ user: me }) => setUser(me))
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => setInitializing(false))
  }, [])

  async function signIn(email: string, password: string) {
    setError(null)
    try {
      const { token, user: me } = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('auth_token', token)
      setUser(me)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Sign in failed'
      setError(msg)
      throw err
    }
  }

  async function signUp(name: string, email: string, password: string) {
    setError(null)
    try {
      const { token, user: me } = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      })
      localStorage.setItem('auth_token', token)
      setUser(me)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed'
      setError(msg)
      throw err
    }
  }

  function signOut() {
    localStorage.removeItem('auth_token')
    setUser(null)
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ user, initializing, signIn, signUp, signOut, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
