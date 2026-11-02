import { Router } from 'express'
import {
  assignApplicationController,
  applicationSummaryController,
  createApplicationController,
  getApplicationController,
  listApplicationsController,
  listDocumentsController,
  listHistoryController,
  saveFieldObservationsController,
  updateApplicationController,
  updateDocumentController,
  updateStatusController,
  uploadDocumentController,
} from '../controllers/applicationController.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { uploadDocument } from '../middleware/documentUpload.js'
import {
  applicationParamsSchema,
  assignApplicationSchema,
  createApplicationSchema,
  documentParamsSchema,
  listApplicationsSchema,
  updateApplicationSchema,
  updateDocumentSchema,
  uploadDocumentSchema,
  updateStatusSchema,
} from '../validators/applications.js'

const applicationRoutes = Router()
applicationRoutes.use(authenticate)

applicationRoutes.get('/', validate(listApplicationsSchema, 'query'), listApplicationsController)
applicationRoutes.post('/', authorize('ADMIN', 'REVENUE_OFFICER'), validate(createApplicationSchema, 'body'), createApplicationController)
applicationRoutes.get('/summary', applicationSummaryController)
applicationRoutes.get('/:applicationId', validate(applicationParamsSchema, 'params'), getApplicationController)
applicationRoutes.patch('/:applicationId', authorize('ADMIN', 'REVENUE_OFFICER'), validate(applicationParamsSchema, 'params'), validate(updateApplicationSchema, 'body'), updateApplicationController)
applicationRoutes.patch('/:applicationId/status', validate(applicationParamsSchema, 'params'), validate(updateStatusSchema, 'body'), updateStatusController)
applicationRoutes.patch('/:applicationId/field-observations', authorize('FIELD_OFFICER'), validate(applicationParamsSchema, 'params'), saveFieldObservationsController)
applicationRoutes.patch('/:applicationId/assign', authorize('ADMIN', 'REVENUE_OFFICER'), validate(applicationParamsSchema, 'params'), validate(assignApplicationSchema, 'body'), assignApplicationController)
applicationRoutes.get('/:applicationId/documents', validate(applicationParamsSchema, 'params'), listDocumentsController)
applicationRoutes.post('/:applicationId/documents', authorize('ADMIN', 'REVENUE_OFFICER'), validate(applicationParamsSchema, 'params'), uploadDocument.single('file'), validate(uploadDocumentSchema, 'body'), uploadDocumentController)
applicationRoutes.patch('/:applicationId/documents/:documentId', authorize('ADMIN', 'REVENUE_OFFICER'), validate(documentParamsSchema, 'params'), validate(updateDocumentSchema, 'body'), updateDocumentController)
applicationRoutes.get('/:applicationId/history', validate(applicationParamsSchema, 'params'), listHistoryController)

export default applicationRoutes
