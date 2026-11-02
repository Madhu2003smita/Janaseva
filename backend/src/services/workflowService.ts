import type { AuthUser } from '../middleware/authenticate.js'
import type { WorkflowStatus } from '../models/Application.js'
import { HttpError } from '../utils/HttpError.js'

export type WorkflowAction =
  | 'start_verification'
  | 'complete_document_verification'
  | 'request_missing_documents'
  | 'return_for_correction'
  | 'resubmit'
  | 'start_field_verification'
  | 'complete_field_verification'
  | 'approve'
  | 'reject'

export function resolveWorkflowTransition(
  status: WorkflowStatus,
  action: WorkflowAction,
  user: AuthUser,
  remarks: string,
  requiredDocumentsVerified = true,
  fieldVerificationComplete = true,
): WorkflowStatus {
  const canDecide = user.role === 'ADMIN' || user.role === 'REVENUE_OFFICER'

  if (action === 'approve' || action === 'reject') {
    if (!canDecide) throw new HttpError(403, 'Only an administrator or revenue officer may record the final decision.', 'FINAL_DECISION_FORBIDDEN')
    if (status !== 'Final decision') throw new HttpError(409, 'Final decisions are only allowed after field verification.', 'INVALID_TRANSITION')
    if (!remarks.trim()) throw new HttpError(400, 'Decision remarks are required.', 'REMARKS_REQUIRED')
    if (!requiredDocumentsVerified) throw new HttpError(409, 'Verify all applicable required documents before finalizing.', 'DOCUMENTS_INCOMPLETE')
    if (!fieldVerificationComplete) throw new HttpError(409, 'Record field verification observations before finalizing.', 'FIELD_VERIFICATION_INCOMPLETE')
    return action === 'approve' ? 'Approved' : 'Rejected'
  }

  if (action === 'start_verification') {
    if (!canDecide) throw new HttpError(403, 'Only an administrator or revenue officer may start document verification.', 'FORBIDDEN')
    if (status !== 'Application received') throw new HttpError(409, 'Verification can only start for a newly received application.', 'INVALID_TRANSITION')
    return 'Document verification'
  }
  if (action === 'complete_document_verification') {
    if (!canDecide) throw new HttpError(403, 'Only an administrator or revenue officer may complete document verification.', 'FORBIDDEN')
    if (status !== 'Document verification') throw new HttpError(409, 'Document verification is not in progress.', 'INVALID_TRANSITION')
    if (!requiredDocumentsVerified) throw new HttpError(409, 'Verify all applicable required documents before continuing.', 'DOCUMENTS_INCOMPLETE')
    return 'Field verification'
  }
  if (action === 'return_for_correction' || action === 'request_missing_documents') {
    if (!canDecide) throw new HttpError(403, 'Only an administrator or revenue officer may return an application for correction.', 'FORBIDDEN')
    if (!['Application received', 'Document verification', 'Field verification', 'Final decision'].includes(status)) {
      throw new HttpError(409, 'This application cannot be returned at its current workflow stage.', 'INVALID_TRANSITION')
    }
    if (!remarks.trim()) throw new HttpError(400, 'Add a reason before returning the application.', 'REMARKS_REQUIRED')
    return 'Returned for correction'
  }
  if (action === 'resubmit') {
    if (!canDecide) throw new HttpError(403, 'Only an administrator or revenue officer may record a resubmission.', 'FORBIDDEN')
    if (status !== 'Returned for correction') throw new HttpError(409, 'Only returned applications can be resubmitted.', 'INVALID_TRANSITION')
    return 'Document verification'
  }
  if (action === 'start_field_verification' || action === 'complete_field_verification') {
    if (user.role !== 'FIELD_OFFICER') throw new HttpError(403, 'Only a field officer may update field verification.', 'FORBIDDEN')
    if (status !== 'Field verification') throw new HttpError(409, 'Field verification is not the current stage.', 'INVALID_TRANSITION')
    if (!remarks.trim()) throw new HttpError(400, 'Add field verification remarks before continuing.', 'REMARKS_REQUIRED')
    if (action === 'complete_field_verification' && !fieldVerificationComplete) {
      throw new HttpError(409, 'Record field verification observations before completing verification.', 'FIELD_VERIFICATION_INCOMPLETE')
    }
    return action === 'start_field_verification' ? 'Field verification' : 'Final decision'
  }
  throw new HttpError(400, 'Unsupported workflow action.', 'INVALID_ACTION')
}
