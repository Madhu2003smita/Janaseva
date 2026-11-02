import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDatabase() {
  mongoose.set('strictQuery', true)
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required when using MongoDB storage.')
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: env.NODE_ENV !== 'production',
  })
  return mongoose.connection
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
