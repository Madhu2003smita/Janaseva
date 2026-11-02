import { Router } from 'express'
import {
  deleteDocumentController,
  downloadDocumentController,
  getDocumentController,
} from '../controllers/documentController.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { objectIdSchema } from '../validators/common.js'
import { z } from 'zod'

const documentRoutes = Router()
const documentParamsSchema = z.object({ documentId: objectIdSchema })
documentRoutes.use(authenticate)
documentRoutes.get('/:documentId', validate(documentParamsSchema, 'params'), getDocumentController)
documentRoutes.get('/:documentId/download', validate(documentParamsSchema, 'params'), downloadDocumentController)
documentRoutes.delete('/:documentId', authorize('ADMIN', 'REVENUE_OFFICER'), validate(documentParamsSchema, 'params'), deleteDocumentController)

export default documentRoutes
