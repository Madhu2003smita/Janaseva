import type { Request, Response } from 'express'
import { login } from '../services/authService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const loginController = asyncHandler(async (request: Request, response: Response) => {
  const result = await login(request.body.email, request.body.password)
  response.json(result)
})

export const meController = asyncHandler(async (request: Request, response: Response) => {
  response.json({ user: request.user })
})
