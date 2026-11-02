import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  applicationSummaryController,
  documentReviewController,
  fieldChecklistController,
  fieldSummaryController,
} from '../controllers/aiController.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import {
  applicationSummaryRequestSchema,
  documentReviewRequestSchema,
  fieldChecklistRequestSchema,
  fieldSummaryRequestSchema,
} from '../validators/ai.js'

const aiRoutes = Router()
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'AI_RATE_LIMITED', message: 'Too many AI requests. Please try again later.' } },
})

aiRoutes.use(authenticate, authorize('ADMIN', 'REVENUE_OFFICER', 'FIELD_OFFICER'), aiLimiter)
aiRoutes.post('/document-review', validate(documentReviewRequestSchema, 'body'), documentReviewController)
aiRoutes.post('/field-checklist', validate(fieldChecklistRequestSchema, 'body'), fieldChecklistController)
aiRoutes.post('/field-summary', validate(fieldSummaryRequestSchema, 'body'), fieldSummaryController)
aiRoutes.post('/application-summary', validate(applicationSummaryRequestSchema, 'body'), applicationSummaryController)

export default aiRoutes
