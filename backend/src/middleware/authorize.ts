import type { RequestHandler } from 'express'
import type { AuthUser } from './authenticate.js'
import { HttpError } from '../utils/HttpError.js'

type Role = AuthUser['role']

export function authorize(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) return next(new HttpError(401, 'Authentication required.', 'UNAUTHENTICATED'))
    if (!roles.includes(request.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'))
    next()
  }
}
