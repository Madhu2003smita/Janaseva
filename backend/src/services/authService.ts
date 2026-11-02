import bcrypt from 'bcryptjs'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'
import { getJsonState } from '../storage/jsonStore.js'

export async function login(email: string, password: string) {
  if (env.STORAGE_MODE === 'json') {
    const user = (await getJsonState()).users.find((candidate) => candidate.email === email.toLowerCase())
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS')
    }
    return {
      token: jwt.sign({ role: user.role }, env.JWT_SECRET, {
        subject: user._id,
        expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
        issuer: 'janaseva-api',
        audience: 'janaseva-client',
      }),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        district: user.district,
      },
    }
  }
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS')
  }
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'janaseva-api',
    audience: 'janaseva-client',
  })
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      district: user.district,
    },
  }
}
