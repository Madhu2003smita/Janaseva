import { Schema, model, type InferSchemaType } from 'mongoose'
import { workflowStatuses } from './Application.js'
import { userRoles } from './User.js'

const auditLogSchema = new Schema({
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorRole: { type: String, enum: userRoles, default: undefined },
  action: { type: String, required: true, trim: true, maxlength: 120 },
  previousStatus: { type: String, enum: workflowStatuses },
  newStatus: { type: String, enum: workflowStatuses },
  remarks: { type: String, trim: true, maxlength: 5000, default: '' },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
}, { versionKey: false })

auditLogSchema.index({ applicationId: 1, timestamp: -1 })

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>
export const AuditLog = model('AuditLog', auditLogSchema)
