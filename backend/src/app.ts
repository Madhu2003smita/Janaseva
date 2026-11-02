import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { storageHealth } from './config/storage.js'
import { errorHandler } from './middleware/errorHandler.js'
import aiRoutes from './routes/aiRoutes.js'
import applicationRoutes from './routes/applicationRoutes.js'
import authRoutes from './routes/authRoutes.js'
import documentRoutes from './routes/documentRoutes.js'
import userRoutes from './routes/userRoutes.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin: env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_request, response, next) => {
  try {
    const health = await storageHealth()
    response.status(health.status === 'ok' ? 200 : 503).json(health)
  } catch (error) {
    next(error)
  }
})
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/users', userRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/documents', documentRoutes)
app.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } })
})
app.use(errorHandler)

export default app
