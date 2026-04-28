import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, apiJson } from '@/lib/api'
import type { AuthUser } from '@/types/profile'

type AuthState = {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (body: Record<string, unknown>) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const r = await api('/auth/me')
    if (r.status === 401) {
      setUser(null)
      return
    }
    if (!r.ok) {
      setUser(null)
      return
    }
    const u = (await r.json()) as AuthUser
    setUser(u)
  }, [])

  useEffect(() => {
    let ok = true
    ;(async () => {
      try {
        await refresh()
      } finally {
        if (ok) {
          setLoading(false)
        }
      }
    })()
    return () => {
      ok = false
    }
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiJson<{ user?: AuthUser }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    /** Dùng user từ body ngay — tránh race setState/async refresh khiến ProtectedAppLayout thấy user=null và đá về /login */
    if (data?.user) {
      setUser(data.user)
      return
    }
    await refresh()
  }, [refresh])

  const register = useCallback(
    async (body: Record<string, unknown>) => {
      const data = await apiJson<{ user?: AuthUser }>('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (data?.user) {
        setUser(data.user)
        return
      }
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, refresh, login, register, logout }),
    [user, loading, refresh, login, register, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return v
}
