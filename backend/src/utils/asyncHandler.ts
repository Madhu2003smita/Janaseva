import type { Request, Response, NextFunction, RequestHandler } from 'express'

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next)
  }
}
