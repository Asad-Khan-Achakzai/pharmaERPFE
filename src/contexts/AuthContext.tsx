'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode
} from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { showApiError } from '@/utils/apiErrors'

export type UserType = 'COMPANY' | 'PLATFORM'

interface AllowedCompany {
  _id: string
  name: string
  city?: string
  currency?: string
  isActive?: boolean
}

export interface User {
  _id: string
  name: string
  email: string
  role: string
  userType?: UserType
  permissions: string[]
  companyId: any
  activeCompanyId?: { _id: string; name: string; city?: string; currency?: string } | string | null
  allowedCompanies?: AllowedCompany[]
  phone?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  hasPermission: (permission: string) => boolean
  /** Platform: switch active tenant (validates access server-side). */
  switchCompanyContext: (companyId: string) => Promise<void>
  refreshUser: () => Promise<void>
  /** True when platform user must pick a company before using tenant-scoped features. */
  needsCompanySelection: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function idKey(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'object' && x !== null && '_id' in x && (x as { _id?: unknown })._id != null) {
    return String((x as { _id: unknown })._id)
  }
  return String(x)
}

function needsSelectCompany(u: User | null): boolean {
  if (!u || u.userType !== 'PLATFORM') return false
  if (!u.allowedCompanies || u.allowedCompanies.length === 0) return true
  return !u.activeCompanyId
}

function authUserEquivalent(a: User | null, b: User | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const perm = (p: string[]) => JSON.stringify([...(p || [])].sort())
  return (
    a._id === b._id &&
    a.role === b.role &&
    a.userType === b.userType &&
    a.email === b.email &&
    a.name === b.name &&
    perm(a.permissions || []) === perm(b.permissions || []) &&
    idKey(a.companyId) === idKey(b.companyId) &&
    idKey(a.activeCompanyId) === idKey(b.activeCompanyId) &&
    JSON.stringify(a.allowedCompanies || []) === JSON.stringify(b.allowedCompanies || [])
  )
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const fetchUserPromiseRef = useRef<Promise<void> | null>(null)
  const lastBackgroundRevalidate = useRef(0)
  const skipBackgroundRevalidateUntil = useRef(0)

  const needsCompanySelection = useMemo(() => needsSelectCompany(user), [user])

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setLoading(false)
      return
    }

    if (fetchUserPromiseRef.current) {
      await fetchUserPromiseRef.current
      return
    }

    const run = (async () => {
      try {
        const { data } = await authService.getMe()
        const next = data.data as User
        setUser((prev) => (authUserEquivalent(prev, next) ? prev : next))
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    })()

    fetchUserPromiseRef.current = run.finally(() => {
      fetchUserPromiseRef.current = null
    })

    await fetchUserPromiseRef.current
  }, [])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  useEffect(() => {
    const REVALIDATE_MIN_MS = 60_000

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (!localStorage.getItem('accessToken')) return
      const now = Date.now()
      if (now < skipBackgroundRevalidateUntil.current) return
      if (now - lastBackgroundRevalidate.current < REVALIDATE_MIN_MS) return
      lastBackgroundRevalidate.current = now
      void fetchUser()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [fetchUser])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await authService.login({ email, password })
      const payload = data.data as { user: User; tokens: { accessToken: string; refreshToken: string } }
      localStorage.setItem('accessToken', payload.tokens.accessToken)
      localStorage.setItem('refreshToken', payload.tokens.refreshToken)
      skipBackgroundRevalidateUntil.current = Date.now() + 5_000
      setUser(payload.user)
      if (needsSelectCompany(payload.user)) {
        router.push('/select-company')
      } else {
        router.push('/home')
      }
    },
    [router]
  )

  const register = useCallback(
    async (regData: any) => {
      const { data } = await authService.register(regData)
      const payload = data.data as { user: User; tokens: { accessToken: string; refreshToken: string } }
      localStorage.setItem('accessToken', payload.tokens.accessToken)
      localStorage.setItem('refreshToken', payload.tokens.refreshToken)
      skipBackgroundRevalidateUntil.current = Date.now() + 5_000
      setUser(payload.user)
      router.push('/home')
    },
    [router]
  )

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    router.push('/login')
  }, [router])

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false
    if (user.role === 'SUPER_ADMIN') return true
    const p = user.permissions || []
    if (p.includes('admin.access')) return true
    return p.includes(permission)
  }, [user])

  const switchCompanyContext = useCallback(
    async (companyId: string) => {
      try {
        const { data } = await authService.switchCompany(companyId)
        const payload = data.data as { tokens: { accessToken: string; refreshToken: string }; user: User }
        localStorage.setItem('accessToken', payload.tokens.accessToken)
        localStorage.setItem('refreshToken', payload.tokens.refreshToken)
        setUser(payload.user)
        await fetchUser()
      } catch (e) {
        showApiError(e, 'Could not switch company')
        throw e
      }
    },
    [fetchUser]
  )

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      hasPermission,
      switchCompanyContext,
      refreshUser: fetchUser,
      needsCompanySelection
    }),
    [user, loading, login, register, logout, hasPermission, switchCompanyContext, fetchUser, needsCompanySelection]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
