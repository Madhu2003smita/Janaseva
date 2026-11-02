import { connectStorage, disconnectStorage, storageHealth } from './config/storage.js'

connectStorage().then(async () => {
  const health = await storageHealth()
  console.info(health.mode === 'json'
    ? 'JSON file storage is ready and validated.'
    : 'MongoDB connection successful.')
}).catch((error: unknown) => {
  console.error(`Storage check failed for STORAGE_MODE=${process.env.STORAGE_MODE ?? 'mongodb'}.`, error)
  process.exitCode = 1
}).finally(async () => {
  await disconnectStorage()
})
