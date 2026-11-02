import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User, userRoles } from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'
import { getJsonState } from '../storage/jsonStore.js'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: typeof userRoles[number]
  district: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  try {
    const header = request.header('authorization')
    if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required.', 'UNAUTHENTICATED')
    const token = header.slice(7)
    const payload = jwt.verify(token, env.JWT_SECRET)
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new HttpError(401, 'Invalid authentication token.', 'INVALID_TOKEN')
    }
    const user = env.STORAGE_MODE === 'json'
      ? (await getJsonState()).users.find((candidate) => candidate._id === payload.sub)
      : await User.findById(payload.sub).select('_id name email role district active').lean()
    if (!user || !user.active) throw new HttpError(401, 'Account is inactive or no longer exists.', 'INVALID_ACCOUNT')
    request.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      district: user.district,
    }
    next()
  } catch (error) {
    next(error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError
      ? new HttpError(401, 'Invalid or expired authentication token.', 'INVALID_TOKEN')
      : error)
  }
}
