import { Schema, model, type InferSchemaType } from 'mongoose'

export const userRoles = ['ADMIN', 'REVENUE_OFFICER', 'FIELD_OFFICER'] as const

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: userRoles, required: true, index: true },
  district: { type: String, required: true, trim: true, maxlength: 100, index: true },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false })

export type UserDocument = InferSchemaType<typeof userSchema>
export const User = model('User', userSchema)
