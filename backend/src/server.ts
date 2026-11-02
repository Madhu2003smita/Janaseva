import app from './app.js'
import { env } from './config/env.js'
import { connectStorage, disconnectStorage } from './config/storage.js'

async function start() {
  await connectStorage()
  const server = app.listen(env.PORT, () => {
    console.info(`JanaSeva API listening on http://localhost:${env.PORT}`)
  })

  const shutdown = (signal: string) => {
    console.info(`${signal} received; shutting down API.`)
    server.close(() => {
      void disconnectStorage().then(() => process.exit(0)).catch((error: unknown) => {
        console.error('Error closing storage adapter:', error)
        process.exit(1)
      })
    })
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((error: unknown) => {
  console.error(`Unable to start JanaSeva API using ${env.STORAGE_MODE} storage. Check storage and environment configuration.`, error)
  process.exitCode = 1
})
