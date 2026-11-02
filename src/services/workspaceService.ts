import { apiClient } from './apiClient'
import type { ApplicationHistoryEntry, WorkflowStatus } from './applicationService'

export type ManagedUser = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'REVENUE_OFFICER' | 'FIELD_OFFICER'
  district: string
  active: boolean
}

export type ManagedUserInput = Pick<ManagedUser, 'name' | 'email' | 'role' | 'district'> & {
  password?: string
}

type RawManagedUser = {
  _id?: string
  id?: string
  name: string
  email: string
  role: ManagedUser['role']
  district: string
  active: boolean
}

type RawHistoryEntry = {
  _id?: string
  id?: string
  timestamp: string
  actor?: string | { name?: string; role?: ApplicationHistoryEntry['actorRole'] }
  actorRole?: ApplicationHistoryEntry['actorRole']
  action: string
  previousStatus?: WorkflowStatus | null
  newStatus?: WorkflowStatus | null
  remarks?: string
}

function mapUser(user: RawManagedUser): ManagedUser {
  return {
    id: user._id ?? user.id ?? '',
    name: user.name,
    email: user.email,
    role: user.role,
    district: user.district,
    active: user.active,
  }
}

export const workspaceService = {
  async listUsers(): Promise<ManagedUser[]> {
    const result = await apiClient.request<{ users: RawManagedUser[] }>('/users')
    return result.users.map(mapUser)
  },

  async createUser(input: ManagedUserInput): Promise<ManagedUser> {
    const result = await apiClient.request<{ user: RawManagedUser }>('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return mapUser(result.user)
  },

  async updateUser(id: string, input: Partial<Pick<ManagedUser, 'name' | 'role' | 'district' | 'active'>>): Promise<ManagedUser> {
    const result = await apiClient.request<{ user: RawManagedUser }>(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return mapUser(result.user)
  },

  async getApplicationHistory(applicationId: string): Promise<ApplicationHistoryEntry[]> {
    const result = await apiClient.request<{ history: RawHistoryEntry[] }>(
      `/applications/${encodeURIComponent(applicationId)}/history`,
    )
    return result.history.map((entry) => ({
      id: entry._id ?? entry.id ?? `${entry.action}-${entry.timestamp}`,
      timestamp: entry.timestamp,
      actor: typeof entry.actor === 'string' ? entry.actor : entry.actor?.name ?? 'Officer',
      actorRole: entry.actorRole ?? (typeof entry.actor === 'object' ? entry.actor?.role : undefined),
      action: entry.action,
      description: entry.remarks ?? '',
      previousStatus: entry.previousStatus ?? undefined,
      newStatus: entry.newStatus ?? undefined,
    }))
  },
}
