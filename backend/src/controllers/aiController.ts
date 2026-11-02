import type { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { aiAssistantService } from '../services/aiAssistantService.js'

export const documentReviewController = asyncHandler(async (request: Request, response: Response) => {
  const result = await aiAssistantService.reviewDocuments(request.body, request.user!)
  response.json(result)
})

export const fieldChecklistController = asyncHandler(async (request: Request, response: Response) => {
  const result = await aiAssistantService.generateFieldChecklist(request.body, request.user!)
  response.json(result)
})

export const fieldSummaryController = asyncHandler(async (request: Request, response: Response) => {
  const result = await aiAssistantService.generateFieldSummary(request.body, request.user!)
  response.json(result)
})

export const applicationSummaryController = asyncHandler(async (request: Request, response: Response) => {
  const result = await aiAssistantService.generateApplicationSummary(request.body, request.user!)
  response.json(result)
})
