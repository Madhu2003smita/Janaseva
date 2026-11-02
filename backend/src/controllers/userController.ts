import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import { User } from '../models/User.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { createUserSchema, listUsersSchema, updateUserSchema } from '../validators/users.js'
import * as jsonService from '../services/jsonApplicationService.js'

export const listOfficersController = asyncHandler(async (request: Request, response: Response) => {
  const district = request.user!.role === 'ADMIN' ? request.query.district : request.user!.district
  if (env.STORAGE_MODE === 'json') {
    response.json({ officers: await jsonService.listOfficers(typeof district === 'string' ? district : undefined) })
    return
  }
  const filter: Record<string, unknown> = {
    active: true,
    role: { $in: ['REVENUE_OFFICER', 'FIELD_OFFICER'] },
  }
  if (typeof district === 'string' && district) filter.district = district
  const officers = await User.find(filter).select('_id name role district').sort({ name: 1 }).lean()
  response.json({ officers })
})

export const listUsersController = asyncHandler(async (request: Request, response: Response) => {
  const query = listUsersSchema.parse(request.query)
  if (env.STORAGE_MODE === 'json') {
    response.json({ users: await jsonService.listUsers(query) })
    return
  }
  const filter: Record<string, unknown> = {}
  if (query.district) filter.district = query.district
  if (query.role) filter.role = query.role
  if (query.active !== undefined) filter.active = query.active
  const users = await User.find(filter).select('_id name email role district active').sort({ name: 1 }).lean()
  response.json({ users })
})

export const createUserController = asyncHandler(async (request: Request, response: Response) => {
  const input = createUserSchema.parse(request.body)
  const passwordHash = await bcrypt.hash(input.password, 12)
  if (env.STORAGE_MODE === 'json') {
    const user = await jsonService.createUser({ ...input, passwordHash })
    response.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, district: user.district, active: user.active },
    })
    return
  }
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: input.role,
    district: input.district,
    active: true,
  })
  response.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      district: user.district,
      active: user.active,
    },
  })
})

export const updateUserController = asyncHandler(async (request: Request, response: Response) => {
  const userId = request.params.userId
  if (!userId || Array.isArray(userId)) throw new HttpError(400, 'User identifier is invalid.', 'INVALID_IDENTIFIER')
  const update = updateUserSchema.parse(request.body)
  if (env.STORAGE_MODE === 'json') {
    const user = await jsonService.updateUser(userId, update)
    response.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, district: user.district, active: user.active },
    })
    return
  }
  const user = await User.findById(userId)
  if (!user) throw new HttpError(404, 'User not found.', 'USER_NOT_FOUND')

  const removingActiveAdmin = user.role === 'ADMIN' && user.active
    && (update.role !== undefined && update.role !== 'ADMIN' || update.active === false)
  if (removingActiveAdmin) {
    const anotherActiveAdmin = await User.exists({ role: 'ADMIN', active: true, _id: { $ne: user._id } })
    if (!anotherActiveAdmin) {
      throw new HttpError(409, 'At least one active administrator must remain.', 'LAST_ADMIN')
    }
  }

  if (update.name !== undefined) user.name = update.name
  if (update.role !== undefined) user.role = update.role
  if (update.district !== undefined) user.district = update.district
  if (update.active !== undefined) user.active = update.active
  await user.save()

  response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      district: user.district,
      active: user.active,
    },
  })
})
