import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import * as service from '../services/applicationService.js'
import { HttpError } from '../utils/HttpError.js'
import { listApplicationsSchema } from '../validators/applications.js'
import { fieldObservationsSchema, uploadDocumentSchema } from '../validators/applications.js'
import * as documentService from '../services/documentService.js'

function applicationIdFrom(request: Request) {
  const applicationId = request.params.applicationId
  if (!applicationId || Array.isArray(applicationId)) {
    throw new HttpError(400, 'Application identifier is invalid.', 'INVALID_IDENTIFIER')
  }
  return applicationId
}

function documentIdFrom(request: Request) {
  const documentId = request.params.documentId
  if (!documentId || Array.isArray(documentId)) {
    throw new HttpError(400, 'Document identifier is invalid.', 'INVALID_IDENTIFIER')
  }
  return documentId
}

export const listApplicationsController = asyncHandler(async (request: Request, response: Response) => {
  const query = listApplicationsSchema.parse(request.query)
  const result = await service.listApplications(request.user!, query)
  response.json(result)
})

export const applicationSummaryController = asyncHandler(async (request: Request, response: Response) => {
  const summary = await service.getSummary(request.user!)
  response.json({ summary })
})

export const getApplicationController = asyncHandler(async (request: Request, response: Response) => {
  const application = await service.getApplication(applicationIdFrom(request), request.user!)
  response.json({ application })
})

export const createApplicationController = asyncHandler(async (request: Request, response: Response) => {
  const application = await service.createApplication(request.body, request.user!)
  response.status(201).json({ application })
})

export const updateApplicationController = asyncHandler(async (request: Request, response: Response) => {
  const application = await service.updateApplication(applicationIdFrom(request), request.body, request.user!)
  response.json({ application })
})

export const updateStatusController = asyncHandler(async (request: Request, response: Response) => {
  const application = await service.transitionApplication(
    applicationIdFrom(request),
    request.body.action,
    request.body.remarks,
    request.user!,
  )
  response.json({ application })
})

export const saveFieldObservationsController = asyncHandler(async (request: Request, response: Response) => {
  const input = fieldObservationsSchema.parse(request.body)
  const application = await service.saveFieldObservations(applicationIdFrom(request), input.observations, request.user!)
  response.json({ application })
})

export const assignApplicationController = asyncHandler(async (request: Request, response: Response) => {
  const application = await service.assignApplication(
    applicationIdFrom(request),
    request.body.officerId,
    request.user!,
  )
  response.json({ application })
})

export const listDocumentsController = asyncHandler(async (request: Request, response: Response) => {
  const documents = await service.listDocuments(applicationIdFrom(request), request.user!)
  response.json({ documents })
})

export const uploadDocumentController = asyncHandler(async (request: Request, response: Response) => {
  const input = uploadDocumentSchema.parse(request.body)
  const document = await documentService.uploadDocument(
    applicationIdFrom(request),
    input,
    request.file,
    request.user!,
  )
  response.status(201).json({ document })
})

export const updateDocumentController = asyncHandler(async (request: Request, response: Response) => {
  const document = await service.updateDocument(
    applicationIdFrom(request),
    documentIdFrom(request),
    request.body,
    request.user!,
  )
  response.json({ document })
})

export const listHistoryController = asyncHandler(async (request: Request, response: Response) => {
  const history = await service.listHistory(applicationIdFrom(request), request.user!)
  response.json({ history })
})
