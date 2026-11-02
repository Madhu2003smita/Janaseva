import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiClient, getAccessToken, type ApiUser } from './services/apiClient'
import { applicationService } from './services/applicationService'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [loading, setLoading] = useState(Boolean(getAccessToken()))
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!getAccessToken()) return
    let active = true
    apiClient.me().then((currentUser) => {
      if (active) {
        setUser(currentUser)
        setAuthError('')
      }
    }).catch((error: unknown) => {
      apiClient.logout()
      applicationService.clearCache()
      if (active) {
        setUser(null)
        setAuthError(error instanceof Error ? error.message : 'Unable to verify your sign-in.')
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    authError,
    async signIn(email, password) {
      const currentUser = await apiClient.login(email, password)
      applicationService.clearCache()
      setUser(currentUser)
      setAuthError('')
    },
    signOut() {
      apiClient.logout()
      applicationService.clearCache()
      setUser(null)
    },
  }), [user, loading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
