import { AuditLog } from '../models/AuditLog.js'
import type { AuthUser } from '../middleware/authenticate.js'
import type { Types } from 'mongoose'
import type { WorkflowStatus } from '../models/Application.js'

type AuditApplication = { _id: Types.ObjectId }

export async function writeAudit(
  application: AuditApplication,
  actor: AuthUser,
  action: string,
  previousStatus: WorkflowStatus | undefined,
  newStatus: WorkflowStatus | undefined,
  remarks: string,
) {
  await AuditLog.create({
    applicationId: application._id,
    actor: actor.id,
    actorRole: actor.role,
    action,
    previousStatus,
    newStatus,
    remarks: remarks.trim(),
  })
}
