import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { loginController, meController } from '../controllers/authController.js'
import { authenticate } from '../middleware/authenticate.js'
import { validate } from '../middleware/validate.js'
import { env } from '../config/env.js'
import { loginSchema } from '../validators/auth.js'

const authRoutes = Router()
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
})

authRoutes.post('/login', loginLimiter, validate(loginSchema, 'body'), loginController)
authRoutes.get('/me', authenticate, meController)

export default authRoutes
