import { Types } from 'mongoose'
import type { AuthUser } from '../middleware/authenticate.js'
import { Application, documentTypes, type ApplicationEntity, type ApplicationPriority, type DocumentUploadMetadata, type WorkflowStatus } from '../models/Application.js'
import { AuditLog } from '../models/AuditLog.js'
import { User } from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'
import { writeAudit } from './auditService.js'
import { resolveWorkflowTransition, type WorkflowAction } from './workflowService.js'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scopedFilter(user: AuthUser) {
  if (user.role === 'ADMIN') return {}
  if (user.role === 'FIELD_OFFICER') return { assignedOfficer: new Types.ObjectId(user.id) }
  return { 'address.district': user.district }
}

async function findAccessible(applicationId: string, user: AuthUser) {
  const application = await Application.findOne({ applicationId, ...scopedFilter(user) })
    .populate('assignedOfficer', 'name email role district active')
  if (!application) throw new HttpError(404, 'Application not found.', 'APPLICATION_NOT_FOUND')
  if (user.role === 'FIELD_OFFICER' && application.assignedOfficer?._id.toString() !== user.id) {
    throw new HttpError(403, 'This application is not assigned to you.', 'FORBIDDEN')
  }
  return application
}

export async function listApplications(user: AuthUser, query: {
  page: number
  pageSize: number
  search?: string
  district?: string
  status?: string
  priority?: string
  submittedFrom?: string
  submittedTo?: string
}) {
  if (query.district && user.role !== 'ADMIN' && query.district !== user.district) {
    throw new HttpError(403, 'You may only view applications in your district.', 'DISTRICT_FORBIDDEN')
  }
  const filter: Record<string, unknown> = { ...scopedFilter(user) }
  if (query.district) filter['address.district'] = query.district
  if (query.status) filter.currentStatus = query.status
  if (query.priority) filter.priority = query.priority
  if (query.search) {
    const search = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ applicationId: search }, { 'applicant.fullName': search }]
  }
  if (query.submittedFrom || query.submittedTo) {
    const submittedAt: Record<string, Date> = {}
    if (query.submittedFrom) submittedAt.$gte = new Date(`${query.submittedFrom}T00:00:00.000Z`)
    if (query.submittedTo) {
      submittedAt.$lt = new Date(new Date(`${query.submittedTo}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
    }
    filter.submittedAt = submittedAt
  }
  const skip = (query.page - 1) * query.pageSize
  const [items, total] = await Promise.all([
    Application.find(filter).populate('assignedOfficer', 'name').sort({ submittedAt: -1 }).skip(skip).limit(query.pageSize).lean(),
    Application.countDocuments(filter),
  ])
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) } }
}

export async function getSummary(user: AuthUser) {
  const filter = scopedFilter(user)
  const overdueBefore = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  const [total, pending, needsAttention, approved, rejected, missingDocuments, overdueFieldVerifications, recentLogs] = await Promise.all([
    Application.countDocuments(filter),
    Application.countDocuments({ ...filter, currentStatus: { $in: ['Application received', 'Document verification', 'Field verification', 'Final decision'] } }),
    Application.countDocuments({ ...filter, $or: [{ currentStatus: 'Returned for correction' }, { documents: { $elemMatch: { applicable: true, verificationStatus: 'Needs correction' } } }] }),
    Application.countDocuments({ ...filter, currentStatus: 'Approved' }),
    Application.countDocuments({ ...filter, currentStatus: 'Rejected' }),
    Application.countDocuments({
      ...filter,
      documents: {
        $elemMatch: {
          applicable: true,
          required: true,
          $or: [
            { fileMetadata: { $exists: false } },
            { 'fileMetadata.storageKey': { $exists: false } },
            { 'fileMetadata.storageKey': '' },
          ],
        },
      },
    }),
    Application.countDocuments({ ...filter, currentStatus: 'Field verification', submittedAt: { $lte: overdueBefore } }),
    AuditLog.find({ applicationId: { $in: await Application.find(filter).distinct('_id') } })
      .populate('actor', 'name')
      .sort({ timestamp: -1 })
      .limit(5)
      .lean(),
  ])
  const applicationIds = recentLogs.map((entry) => entry.applicationId)
  const recentApplications = await Application.find({ _id: { $in: applicationIds } }).select('_id applicationId applicant.fullName').lean()
  const namesById = new Map(recentApplications.map((application) => [application._id.toString(), application.applicant.fullName]))
  return {
    total,
    pending,
    needsAttention,
    approved,
    rejected,
    missingDocuments,
    overdueFieldVerifications,
    recentActivity: recentLogs.map((entry) => ({
      id: entry._id.toString(),
      applicationId: entry.applicationId.toString(),
      applicantName: namesById.get(entry.applicationId.toString()) ?? 'Application',
      actor: typeof entry.actor === 'object' && entry.actor && 'name' in entry.actor ? entry.actor.name : 'Officer',
      action: entry.action,
      timestamp: entry.timestamp,
      remarks: entry.remarks,
    })),
  }
}

export async function getApplication(applicationId: string, user: AuthUser) {
  return findAccessible(applicationId, user)
}

export async function createApplication(input: {
  applicant: { fullName: string; fatherOrGuardianName: string; mobile: string }
  address: { address: string; district: string; block: string; gramPanchayat: string }
  annualIncome: number
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  documents: { documentType: string; applicable: boolean; required: boolean; verificationStatus?: string; officerRemarks?: string }[]
  verificationRemarks: string
  assignedOfficer?: string
}, user: AuthUser) {
  if (user.role !== 'ADMIN' && input.address.district !== user.district) {
    throw new HttpError(403, 'You may only create applications in your district.', 'DISTRICT_FORBIDDEN')
  }
  if (input.assignedOfficer) {
    const officer = await User.findOne({ _id: input.assignedOfficer, active: true, district: input.address.district, role: { $in: ['REVENUE_OFFICER', 'FIELD_OFFICER'] } })
    if (!officer) throw new HttpError(400, 'The assigned officer is invalid for this district.', 'INVALID_OFFICER')
  }
  const sequence = await Application.countDocuments({ applicationId: new RegExp(`^INC-${new Date().getFullYear()}-`) }) + 1
  const record = await Application.create({
    applicationId: `INC-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
    applicant: input.applicant,
    address: input.address,
    annualIncome: input.annualIncome,
    priority: input.priority,
    documents: input.documents,
    verificationRemarks: input.verificationRemarks,
    assignedOfficer: input.assignedOfficer,
    createdBy: user.id,
  })
  await writeAudit(record, user, 'Application submitted', undefined, record.currentStatus, 'Income certificate application submitted.')
  return record
}

export async function updateApplication(applicationId: string, patch: { priority?: ApplicationPriority; verificationRemarks?: string }, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  if (user.role === 'FIELD_OFFICER' && patch.priority !== undefined) {
    throw new HttpError(403, 'Field officers cannot change application priority.', 'FORBIDDEN')
  }
  const previousStatus = application.currentStatus
  if (patch.priority !== undefined) application.priority = patch.priority
  if (patch.verificationRemarks !== undefined) application.verificationRemarks = patch.verificationRemarks
  await application.save()
  await writeAudit(application, user, 'Application updated', previousStatus, application.currentStatus, patch.verificationRemarks ?? 'Application details updated.')
  return application
}

export async function saveFieldObservations(applicationId: string, observations: string, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  if (user.role !== 'FIELD_OFFICER') throw new HttpError(403, 'Only a field officer may record field observations.', 'FORBIDDEN')
  if (application.currentStatus !== 'Field verification') throw new HttpError(409, 'Field observations can only be recorded during field verification.', 'INVALID_TRANSITION')
  application.fieldObservations = observations.trim()
  await application.save()
  await writeAudit(application, user, 'Field observations recorded', application.currentStatus, application.currentStatus, 'Officer field observations updated.')
  return application
}

export async function recordAiAssistAction(applicationId: string, user: AuthUser, action: string) {
  const application = await findAccessible(applicationId, user)
  await writeAudit(application, user, action, application.currentStatus, application.currentStatus, 'AI-generated assistance provided for officer review.')
}

export async function transitionApplication(applicationId: string, action: WorkflowAction, remarks: string, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  const previousStatus = application.currentStatus
  if (action === 'start_field_verification' || action === 'complete_field_verification') {
    if (user.role === 'FIELD_OFFICER' && application.assignedOfficer?._id.toString() !== user.id) {
      throw new HttpError(403, 'Only the assigned field officer may update this application.', 'FORBIDDEN')
    }
  }
  const requiredDocumentsVerified = application.documents.every((document) =>
    !document.applicable || !document.required
    || (Boolean(document.fileMetadata?.storageKey) && document.verificationStatus === 'Verified'),
  )
  const fieldVerificationComplete = Boolean(application.fieldObservations.trim())
  const nextStatus = resolveWorkflowTransition(previousStatus, action, user, remarks, requiredDocumentsVerified, fieldVerificationComplete)
  if (action === 'approve' || action === 'reject') {
    const result = await Application.updateOne(
      {
        _id: application._id,
        currentStatus: 'Final decision',
        fieldObservations: /\S/,
        $nor: [{
          documents: {
            $elemMatch: {
              applicable: true,
              required: true,
              $or: [
                { verificationStatus: { $ne: 'Verified' } },
                { 'fileMetadata.storageKey': { $in: [null, ''] } },
              ],
            },
          },
        }],
      },
      { $set: { currentStatus: nextStatus, verificationRemarks: remarks.trim(), updatedAt: new Date() } },
    )
    if (result.matchedCount !== 1) {
      throw new HttpError(409, 'A final decision has already been recorded or the workflow has changed.', 'INVALID_TRANSITION')
    }
    application.currentStatus = nextStatus
    application.verificationRemarks = remarks.trim()
  } else {
    const update: { $set: Record<string, unknown> } = {
      $set: { currentStatus: nextStatus, updatedAt: new Date() },
    }
    if (remarks.trim()) update.$set.verificationRemarks = remarks.trim()
    const result = await Application.updateOne(
      { _id: application._id, currentStatus: previousStatus },
      update,
    )
    if (result.matchedCount !== 1) {
      throw new HttpError(409, 'The workflow changed before this action could be recorded. Refresh and try again.', 'WORKFLOW_CHANGED')
    }
    application.currentStatus = nextStatus
    if (remarks.trim()) application.verificationRemarks = remarks.trim()
  }
  const actions: Record<WorkflowAction, string> = {
    start_verification: 'Document verification started',
    complete_document_verification: 'Documents verified',
    request_missing_documents: 'Missing documents requested',
    return_for_correction: 'Application returned',
    resubmit: 'Application resubmitted',
    start_field_verification: 'Field verification started',
    complete_field_verification: 'Field verification completed',
    approve: 'Application approved',
    reject: 'Application rejected',
  }
  await writeAudit(application, user, actions[action], previousStatus, application.currentStatus, remarks)
  return application
}

export async function assignApplication(applicationId: string, officerId: string, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  if (user.role === 'FIELD_OFFICER') throw new HttpError(403, 'Field officers cannot assign applications.', 'FORBIDDEN')
  const officer = await User.findOne({
    _id: officerId,
    active: true,
    district: application.address.district,
    role: { $in: ['REVENUE_OFFICER', 'FIELD_OFFICER'] },
  })
  if (!officer) throw new HttpError(400, 'The selected officer is invalid for this district.', 'INVALID_OFFICER')
  application.assignedOfficer = officer._id
  await application.save()
  await writeAudit(application, user, 'Application assigned', application.currentStatus, application.currentStatus, `Assigned to ${officer.name}.`)
  return application.populate('assignedOfficer', 'name email role district active')
}

export async function listDocuments(applicationId: string, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  return application.documents
}

export async function updateDocument(applicationId: string, documentId: string, input: { verificationStatus: 'Pending' | 'Verified' | 'Needs correction'; officerRemarks: string }, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  if (user.role !== 'ADMIN' && user.role !== 'REVENUE_OFFICER') {
    throw new HttpError(403, 'Only an administrator or revenue officer may review documents.', 'FORBIDDEN')
  }
  if (!['Document verification'].includes(application.currentStatus)) {
    throw new HttpError(409, 'Documents can only be updated during document verification.', 'INVALID_TRANSITION')
  }
  const document = application.documents.id(documentId)
  if (!document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  if (!document.applicable) throw new HttpError(409, 'This document is not applicable to this application.', 'DOCUMENT_NOT_APPLICABLE')
  if (input.verificationStatus === 'Verified' && !document.fileMetadata?.storageKey) {
    throw new HttpError(409, 'A document without an uploaded file cannot be verified.', 'DOCUMENT_MISSING')
  }
  const previousStatus = application.currentStatus
  const documentFilter = {
    _id: documentId,
    applicable: true,
    ...(document.fileMetadata?.storageKey ? { 'fileMetadata.storageKey': document.fileMetadata.storageKey } : {}),
  }
  const result = await Application.updateOne({
    _id: application._id,
    currentStatus: previousStatus,
    documents: { $elemMatch: documentFilter },
  }, {
    $set: {
      'documents.$.verificationStatus': input.verificationStatus,
      'documents.$.officerRemarks': input.officerRemarks,
      updatedAt: new Date(),
    },
  })
  if (result.matchedCount !== 1) {
    throw new HttpError(409, 'The application or document changed. Refresh and try again.', 'WORKFLOW_CHANGED')
  }
  document.verificationStatus = input.verificationStatus
  document.officerRemarks = input.officerRemarks
  const action = input.verificationStatus === 'Verified'
    ? 'Document verified'
    : input.verificationStatus === 'Needs correction'
      ? 'Document returned for correction'
      : 'Document check updated'
  await writeAudit(application, user, action, previousStatus, application.currentStatus, `${document.documentType}: ${input.verificationStatus}${input.officerRemarks ? ` — ${input.officerRemarks}` : ''}`)
  return document
}

function assertDocumentsEditable(application: { currentStatus: WorkflowStatus }) {
  if (application.currentStatus === 'Approved' || application.currentStatus === 'Rejected') {
    throw new HttpError(409, 'Documents cannot be changed after a final decision.', 'DOCUMENTS_LOCKED')
  }
}

export async function attachDocument(applicationId: string, input: {
  documentId?: string
  documentType?: typeof documentTypes[number]
  applicable?: boolean
  required?: boolean
  fileMetadata: DocumentUploadMetadata
}, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  if (user.role === 'FIELD_OFFICER') throw new HttpError(403, 'Field officers cannot upload application documents.', 'FORBIDDEN')
  assertDocumentsEditable(application)
  let document = input.documentId ? application.documents.id(input.documentId) : undefined
  if (input.documentId && !document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  if (document && !document.applicable) throw new HttpError(409, 'This document is not applicable to this application.', 'DOCUMENT_NOT_APPLICABLE')
  const fileMetadata = { ...input.fileMetadata, uploadedAt: new Date(input.fileMetadata.uploadedAt) }
  const previousStorageKey = document?.fileMetadata?.storageKey
  if (!document) {
    if (!input.documentType) throw new HttpError(400, 'A document category is required.', 'DOCUMENT_TYPE_REQUIRED')
    if (application.documents.length >= 20) throw new HttpError(409, 'An application cannot contain more than 20 document records.', 'DOCUMENT_LIMIT_REACHED')
    const newDocument = {
      _id: new Types.ObjectId(),
      documentType: input.documentType,
      applicable: input.applicable ?? true,
      required: input.required ?? false,
      verificationStatus: 'Pending',
      officerRemarks: '',
      fileMetadata,
    }
    const result = await Application.updateOne({
      _id: application._id,
      currentStatus: application.currentStatus,
      $expr: { $lt: [{ $size: '$documents' }, 20] },
    }, {
      $push: { documents: newDocument },
      $set: { updatedAt: new Date() },
    })
    if (result.matchedCount !== 1) {
      throw new HttpError(409, 'The application changed or already has the maximum number of document records.', 'WORKFLOW_CHANGED')
    }
    application.documents.push(newDocument)
    document = application.documents.at(-1)
  } else {
    const result = await Application.updateOne({
      _id: application._id,
      currentStatus: application.currentStatus,
      documents: { $elemMatch: { _id: document._id, applicable: true } },
    }, {
      $set: {
        'documents.$.fileMetadata': fileMetadata,
        'documents.$.verificationStatus': 'Pending',
        'documents.$.officerRemarks': '',
        updatedAt: new Date(),
      },
    })
    if (result.matchedCount !== 1) {
      throw new HttpError(409, 'The application or document changed. Refresh and try again.', 'WORKFLOW_CHANGED')
    }
    document.fileMetadata = fileMetadata
    document.verificationStatus = 'Pending'
    document.officerRemarks = ''
  }
  if (!document) throw new HttpError(500, 'Unable to create the document record.', 'DOCUMENT_CREATE_FAILED')
  await writeAudit(application, user, previousStorageKey ? 'Document replaced' : 'Document uploaded',
    application.currentStatus, application.currentStatus, `${document.documentType} document file updated.`)
  return { document, previousStorageKey }
}

export async function getDocumentById(documentId: string, user: AuthUser) {
  const application = await Application.findOne({ 'documents._id': documentId })
  if (!application) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  await findAccessible(application.applicationId, user)
  const document = application.documents.id(documentId)
  if (!document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  return { applicationId: application.applicationId, document }
}

export async function deleteDocument(documentId: string, user: AuthUser) {
  const application = await Application.findOne({ 'documents._id': documentId })
  if (!application) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  await findAccessible(application.applicationId, user)
  if (user.role === 'FIELD_OFFICER') throw new HttpError(403, 'Field officers cannot delete application documents.', 'FORBIDDEN')
  assertDocumentsEditable(application)
  const document = application.documents.id(documentId)
  if (!document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  const previousStorageKey = document.fileMetadata?.storageKey
  if (!previousStorageKey) throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
  const result = await Application.updateOne({
    _id: application._id,
    currentStatus: application.currentStatus,
    'documents._id': documentId,
    'documents.fileMetadata.storageKey': previousStorageKey,
  }, {
    $unset: { 'documents.$.fileMetadata': 1 },
    $set: { 'documents.$.verificationStatus': 'Pending', updatedAt: new Date() },
  })
  if (result.matchedCount !== 1) {
    const currentApplication = await findAccessible(application.applicationId, user)
    assertDocumentsEditable(currentApplication)
    throw new HttpError(409, 'The application or document changed. Refresh and try again.', 'WORKFLOW_CHANGED')
  }
  document.fileMetadata = undefined
  document.verificationStatus = 'Pending'
  await writeAudit(application, user, 'Document deleted', application.currentStatus, application.currentStatus, `${document.documentType} document file deleted.`)
  return { document, previousStorageKey }
}

export async function recordDocumentViewed(documentId: string, user: AuthUser) {
  const { applicationId, document } = await getDocumentById(documentId, user)
  if (!document.fileMetadata?.storageKey) throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
  const application = await findAccessible(applicationId, user)
  await writeAudit(application, user, 'Document viewed', application.currentStatus, application.currentStatus, `${document.documentType} document file viewed.`)
}

export async function listHistory(applicationId: string, user: AuthUser) {
  const application = await findAccessible(applicationId, user)
  return AuditLog.find({ applicationId: application._id })
    .populate('actor', 'name role')
    .sort({ timestamp: -1 })
    .lean()
}

export function getApplicationId(application: ApplicationEntity) {
  return application.applicationId
}
