import { createContext } from 'react'
import type { ApiUser } from './services/apiClient'

export type AuthContextValue = {
  user: ApiUser | null
  loading: boolean
  authError: string
  signIn(email: string, password: string): Promise<void>
  signOut(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
