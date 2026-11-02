import mongoose from 'mongoose'
import { env } from './env.js'
import { connectDatabase, disconnectDatabase } from './database.js'
import { connectJsonStorage, disconnectJsonStorage, getJsonState } from '../storage/jsonStore.js'

export async function connectStorage() {
  if (env.STORAGE_MODE === 'json') {
    await connectJsonStorage()
    return
  }
  await connectDatabase()
}

export async function disconnectStorage() {
  if (env.STORAGE_MODE === 'json') {
    await disconnectJsonStorage()
    return
  }
  await disconnectDatabase()
}

export async function storageHealth() {
  if (env.STORAGE_MODE === 'json') {
    try {
      await getJsonState()
      return { status: 'ok' as const, mode: 'json' as const, storage: 'ready' as const }
    } catch {
      return { status: 'unavailable' as const, mode: 'json' as const, storage: 'unavailable' as const }
    }
  }
  const connected = mongoose.connection.readyState === 1
  return {
    status: connected ? 'ok' as const : 'unavailable' as const,
    mode: 'mongodb' as const,
    storage: connected ? 'connected' as const : 'disconnected' as const,
  }
}
