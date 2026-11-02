import type { AuthUser } from '../middleware/authenticate.js'
import type { ApplicationPriority, DocumentUploadMetadata, WorkflowStatus } from '../models/Application.js'
import { getJsonState, makeId, updateJsonState, type JsonApplication, type JsonStoreState, type JsonUser } from '../storage/jsonStore.js'
import { HttpError } from '../utils/HttpError.js'
import { resolveWorkflowTransition, type WorkflowAction } from './workflowService.js'

function assertAccessible(application: JsonApplication | undefined, user: AuthUser) {
  if (!application) throw new HttpError(404, 'Application not found.', 'APPLICATION_NOT_FOUND')
  if (user.role === 'REVENUE_OFFICER' && application.address.district !== user.district) {
    throw new HttpError(404, 'Application not found.', 'APPLICATION_NOT_FOUND')
  }
  if (user.role === 'FIELD_OFFICER' && application.assignedOfficer !== user.id) {
    throw new HttpError(403, 'This application is not assigned to you.', 'FORBIDDEN')
  }
  return application
}

function presentApplication(application: JsonApplication, users: JsonUser[]) {
  const assignedOfficer = application.assignedOfficer
    ? users.find((user) => user._id === application.assignedOfficer)
    : undefined
  return {
    ...application,
    submittedAt: new Date(application.submittedAt),
    createdAt: new Date(application.createdAt),
    updatedAt: new Date(application.updatedAt),
    assignedOfficer: assignedOfficer
      ? { _id: assignedOfficer._id, name: assignedOfficer.name, email: assignedOfficer.email, role: assignedOfficer.role, district: assignedOfficer.district, active: assignedOfficer.active }
      : null,
    documents: application.documents.map((document) => ({
      ...document,
      createdAt: new Date(application.createdAt),
      updatedAt: new Date(application.updatedAt),
      ...(document.fileMetadata?.uploadedAt ? { fileMetadata: { ...document.fileMetadata, uploadedAt: new Date(document.fileMetadata.uploadedAt) } } : {}),
    })),
  }
}

function audit(state: JsonStoreState, application: JsonApplication, user: AuthUser, action: string, previousStatus: WorkflowStatus | undefined, newStatus: WorkflowStatus | undefined, remarks: string) {
  state.auditLogs.push({
    _id: makeId(),
    applicationId: application._id,
    actor: user.id,
    actorRole: user.role,
    action,
    previousStatus: previousStatus ?? null,
    newStatus: newStatus ?? null,
    remarks: remarks.trim(),
    timestamp: new Date().toISOString(),
  })
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
  const state = await getJsonState()
  const search = query.search?.toLocaleLowerCase()
  const from = query.submittedFrom ? Date.parse(`${query.submittedFrom}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY
  const to = query.submittedTo ? Date.parse(`${query.submittedTo}T23:59:59.999Z`) : Number.POSITIVE_INFINITY
  const matches = state.applications.filter((application) => {
    if (user.role === 'REVENUE_OFFICER' && application.address.district !== user.district) return false
    if (user.role === 'FIELD_OFFICER' && application.assignedOfficer !== user.id) return false
    if (query.district && application.address.district !== query.district) return false
    if (query.status && application.currentStatus !== query.status) return false
    if (query.priority && application.priority !== query.priority) return false
    const submittedAt = Date.parse(application.submittedAt)
    if (submittedAt < from || submittedAt > to) return false
    return !search || application.applicationId.toLocaleLowerCase().includes(search)
      || application.applicant.fullName.toLocaleLowerCase().includes(search)
  }).sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt))
  const offset = (query.page - 1) * query.pageSize
  return {
    items: matches.slice(offset, offset + query.pageSize).map((application) => presentApplication(application, state.users)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: matches.length,
      pages: Math.ceil(matches.length / query.pageSize),
    },
  }
}

export async function getSummary(user: AuthUser) {
  const state = await getJsonState()
  const applications = state.applications.filter((application) => {
    if (user.role === 'REVENUE_OFFICER') return application.address.district === user.district
    if (user.role === 'FIELD_OFFICER') return application.assignedOfficer === user.id
    return true
  })
  const overdueBefore = Date.now() - 5 * 24 * 60 * 60 * 1000
  const logs = state.auditLogs
    .filter((entry) => applications.some((application) => application._id === entry.applicationId))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 5)
  return {
    total: applications.length,
    pending: applications.filter((application) => ['Application received', 'Document verification', 'Field verification', 'Final decision'].includes(application.currentStatus)).length,
    needsAttention: applications.filter((application) => application.currentStatus === 'Returned for correction' || application.documents.some((document) => document.applicable && document.verificationStatus === 'Needs correction')).length,
    approved: applications.filter((application) => application.currentStatus === 'Approved').length,
    rejected: applications.filter((application) => application.currentStatus === 'Rejected').length,
    missingDocuments: applications.filter((application) => application.documents.some((document) =>
      document.applicable && document.required && !document.fileMetadata?.storageKey,
    )).length,
    overdueFieldVerifications: applications.filter((application) => application.currentStatus === 'Field verification' && Date.parse(application.submittedAt) <= overdueBefore).length,
    recentActivity: logs.map((entry) => {
      const application = applications.find((item) => item._id === entry.applicationId)
      const actor = state.users.find((item) => item._id === entry.actor)
      return {
        id: entry._id,
        applicationId: application?.applicationId ?? '',
        applicantName: application?.applicant.fullName ?? 'Application',
        actor: actor?.name ?? 'Officer',
        action: entry.action,
        timestamp: new Date(entry.timestamp),
        remarks: entry.remarks,
      }
    }),
  }
}

export async function getApplication(applicationId: string, user: AuthUser) {
  const state = await getJsonState()
  const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
  return presentApplication(application, state.users)
}

export async function createApplication(input: {
  applicant: { fullName: string; fatherOrGuardianName: string; mobile: string }
  address: { address: string; district: string; block: string; gramPanchayat: string }
  annualIncome: number
  priority: ApplicationPriority
  documents: { documentType: string; applicable: boolean; required: boolean; verificationStatus?: string; officerRemarks?: string }[]
  verificationRemarks: string
  assignedOfficer?: string
}, user: AuthUser) {
  if (user.role !== 'ADMIN' && input.address.district !== user.district) {
    throw new HttpError(403, 'You may only create applications in your district.', 'DISTRICT_FORBIDDEN')
  }
  return updateJsonState((state) => {
    const assigned = input.assignedOfficer
      ? state.users.find((candidate) => candidate._id === input.assignedOfficer && candidate.active
        && candidate.district === input.address.district && ['REVENUE_OFFICER', 'FIELD_OFFICER'].includes(candidate.role))
      : undefined
    if (input.assignedOfficer && !assigned) throw new HttpError(400, 'The assigned officer is invalid for this district.', 'INVALID_OFFICER')
    const year = new Date().getFullYear()
    let sequence = state.applications.filter((item) => item.applicationId.startsWith(`INC-${year}-`)).length + 1
    let applicationId = `INC-${year}-${String(sequence).padStart(4, '0')}`
    while (state.applications.some((item) => item.applicationId === applicationId)) {
      sequence += 1
      applicationId = `INC-${year}-${String(sequence).padStart(4, '0')}`
    }
    const now = new Date().toISOString()
    const application: JsonApplication = {
      _id: makeId(),
      applicationId,
      applicant: input.applicant,
      address: input.address,
      annualIncome: input.annualIncome,
      submittedAt: now,
      assignedOfficer: assigned?._id ?? null,
      currentStatus: 'Application received',
      priority: input.priority,
      documents: input.documents.map((document) => ({
        _id: makeId(),
        documentType: document.documentType as JsonApplication['documents'][number]['documentType'],
        applicable: document.applicable,
        required: document.required,
        verificationStatus: (document.verificationStatus ?? 'Pending') as JsonApplication['documents'][number]['verificationStatus'],
        officerRemarks: document.officerRemarks ?? '',
      })),
      verificationRemarks: input.verificationRemarks,
      fieldObservations: '',
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    }
    state.applications.push(application)
    audit(state, application, user, 'Application submitted', undefined, application.currentStatus, 'Income certificate application submitted.')
    return presentApplication(application, state.users)
  })
}

export async function saveFieldObservations(applicationId: string, observations: string, user: AuthUser) {
  return updateJsonState((state) => {
    const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
    if (user.role !== 'FIELD_OFFICER') throw new HttpError(403, 'Only a field officer may record field observations.', 'FORBIDDEN')
    if (application.currentStatus !== 'Field verification') throw new HttpError(409, 'Field observations can only be recorded during field verification.', 'INVALID_TRANSITION')
    application.fieldObservations = observations.trim()
    application.updatedAt = new Date().toISOString()
    audit(state, application, user, 'Field observations recorded', application.currentStatus, application.currentStatus, 'Officer field observations updated.')
    return presentApplication(application, state.users)
  })
}

export async function recordAiAssistAction(applicationId: string, user: AuthUser, action: string) {
  return updateJsonState((state) => {
    const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
    audit(state, application, user, action, application.currentStatus, application.currentStatus, 'AI-generated assistance provided for officer review.')
  })
}

export async function updateApplication(applicationId: string, patch: { priority?: ApplicationPriority; verificationRemarks?: string }, user: AuthUser) {
  if (user.role === 'FIELD_OFFICER' && patch.priority !== undefined) {
    throw new HttpError(403, 'Field officers cannot change application priority.', 'FORBIDDEN')
  }
  return updateJsonState((state) => {
    const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
    const previousStatus = application.currentStatus
    if (patch.priority !== undefined) application.priority = patch.priority
    if (patch.verificationRemarks !== undefined) application.verificationRemarks = patch.verificationRemarks
    application.updatedAt = new Date().toISOString()
    audit(state, application, user, 'Application updated', previousStatus, application.currentStatus, patch.verificationRemarks ?? 'Application details updated.')
    return presentApplication(application, state.users)
  })
}

export async function transitionApplication(applicationId: string, action: WorkflowAction, remarks: string, user: AuthUser) {
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
  return updateJsonState((state) => {
    const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
    const previousStatus = application.currentStatus
    const requiredDocumentsVerified = application.documents.every((document) =>
      !document.applicable || !document.required || (Boolean(document.fileMetadata?.storageKey) && document.verificationStatus === 'Verified'))
    const fieldVerificationComplete = Boolean(application.fieldObservations.trim())
    application.currentStatus = resolveWorkflowTransition(previousStatus, action, user, remarks, requiredDocumentsVerified, fieldVerificationComplete)
    if (remarks.trim()) application.verificationRemarks = remarks.trim()
    application.updatedAt = new Date().toISOString()
    audit(state, application, user, actions[action], previousStatus, application.currentStatus, remarks)
    return presentApplication(application, state.users)
  })
}

export async function assignApplication(applicationId: string, officerId: string, user: AuthUser) {
  if (user.role === 'FIELD_OFFICER') throw new HttpError(403, 'Field officers cannot assign applications.', 'FORBIDDEN')
  return updateJsonState((state) => {
    const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
    const officer = state.users.find((candidate) => candidate._id === officerId && candidate.active
      && candidate.district === application.address.district && ['REVENUE_OFFICER', 'FIELD_OFFICER'].includes(candidate.role))
    if (!officer) throw new HttpError(400, 'The selected officer is invalid for this district.', 'INVALID_OFFICER')
    const previousStatus = application.currentStatus
    application.assignedOfficer = officer._id
    application.updatedAt = new Date().toISOString()
    audit(state, application, user, 'Application assigned', previousStatus, application.currentStatus, `Assigned to ${officer.name}.`)
    return presentApplication(application, state.users)
  })
}

export async function listDocuments(applicationId: string, user: AuthUser) {
  const application = await getApplication(applicationId, user)
  return application.documents
}

export async function updateDocument(applicationId: string, documentId: string, input: { verificationStatus: 'Pending' | 'Verified' | 'Needs correction'; officerRemarks: string }, user: AuthUser) {
  return updateJsonState((state) => {
    const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
    if (user.role !== 'ADMIN' && user.role !== 'REVENUE_OFFICER') {
      throw new HttpError(403, 'Only an administrator or revenue officer may review documents.', 'FORBIDDEN')
    }
    if (application.currentStatus !== 'Document verification') {
      throw new HttpError(409, 'Documents can only be updated during document verification.', 'INVALID_TRANSITION')
    }
    const document = application.documents.find((item) => item._id === documentId)
    if (!document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
    if (!document.applicable) throw new HttpError(409, 'This document is not applicable to this application.', 'DOCUMENT_NOT_APPLICABLE')
    if (input.verificationStatus === 'Verified' && !document.fileMetadata?.storageKey) {
      throw new HttpError(409, 'A document without an uploaded file cannot be verified.', 'DOCUMENT_MISSING')
    }
    const previousStatus = application.currentStatus
    document.verificationStatus = input.verificationStatus
    document.officerRemarks = input.officerRemarks
    application.updatedAt = new Date().toISOString()
    const action = input.verificationStatus === 'Verified'
      ? 'Document verified'
      : input.verificationStatus === 'Needs correction'
        ? 'Document returned for correction'
        : 'Document check updated'
    audit(state, application, user, action, previousStatus, application.currentStatus,
      `${document.documentType}: ${input.verificationStatus}${input.officerRemarks ? ` — ${input.officerRemarks}` : ''}`)
    return document
  })
}

function assertDocumentsEditable(application: JsonApplication) {
  if (application.currentStatus === 'Approved' || application.currentStatus === 'Rejected') {
    throw new HttpError(409, 'Documents cannot be changed after a final decision.', 'DOCUMENTS_LOCKED')
  }
}

export async function attachDocument(applicationId: string, input: {
  documentId?: string
  documentType?: JsonApplication['documents'][number]['documentType']
  applicable?: boolean
  required?: boolean
  fileMetadata: DocumentUploadMetadata
}, user: AuthUser) {
  return updateJsonState((state) => {
    const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
    if (user.role === 'FIELD_OFFICER') throw new HttpError(403, 'Field officers cannot upload application documents.', 'FORBIDDEN')
    assertDocumentsEditable(application)
    let document = input.documentId
      ? application.documents.find((item) => item._id === input.documentId)
      : undefined
    if (input.documentId && !document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
    if (document && !document.applicable) throw new HttpError(409, 'This document is not applicable to this application.', 'DOCUMENT_NOT_APPLICABLE')
    if (!document) {
      if (!input.documentType) throw new HttpError(400, 'A document category is required.', 'DOCUMENT_TYPE_REQUIRED')
      if (application.documents.length >= 20) throw new HttpError(409, 'An application cannot contain more than 20 document records.', 'DOCUMENT_LIMIT_REACHED')
      document = {
        _id: makeId(),
        documentType: input.documentType,
        applicable: input.applicable ?? true,
        required: input.required ?? false,
        verificationStatus: 'Pending',
        officerRemarks: '',
      }
      application.documents.push(document)
    }
    const previousStorageKey = document.fileMetadata?.storageKey
    document.fileMetadata = input.fileMetadata
    document.verificationStatus = 'Pending'
    document.officerRemarks = ''
    application.updatedAt = new Date().toISOString()
    audit(state, application, user, previousStorageKey ? 'Document replaced' : 'Document uploaded',
      application.currentStatus, application.currentStatus, `${document.documentType} document file updated.`)
    return { document, previousStorageKey }
  })
}

export async function getDocumentById(documentId: string, user: AuthUser) {
  const state = await getJsonState()
  const application = state.applications.find((item) => item.documents.some((document) => document._id === documentId))
  if (!application) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  assertAccessible(application, user)
  const document = application.documents.find((item) => item._id === documentId)
  if (!document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
  return { applicationId: application.applicationId, document }
}

export async function deleteDocument(documentId: string, user: AuthUser) {
  return updateJsonState((state) => {
    const application = state.applications.find((item) => item.documents.some((document) => document._id === documentId))
    if (!application) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
    assertAccessible(application, user)
    if (user.role === 'FIELD_OFFICER') throw new HttpError(403, 'Field officers cannot delete application documents.', 'FORBIDDEN')
    assertDocumentsEditable(application)
    const document = application.documents.find((item) => item._id === documentId)
    if (!document) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
    const previousStorageKey = document.fileMetadata?.storageKey
    if (!previousStorageKey) throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
    document.fileMetadata = undefined
    document.verificationStatus = 'Pending'
    application.updatedAt = new Date().toISOString()
    audit(state, application, user, 'Document deleted', application.currentStatus, application.currentStatus, `${document.documentType} document file deleted.`)
    return { document, previousStorageKey }
  })
}

export async function recordDocumentViewed(documentId: string, user: AuthUser) {
  return updateJsonState((state) => {
    const application = state.applications.find((item) => item.documents.some((document) => document._id === documentId))
    if (!application) throw new HttpError(404, 'Document not found.', 'DOCUMENT_NOT_FOUND')
    assertAccessible(application, user)
    const document = application.documents.find((item) => item._id === documentId)
    if (!document?.fileMetadata?.storageKey) throw new HttpError(404, 'Document file not found.', 'DOCUMENT_FILE_NOT_FOUND')
    audit(state, application, user, 'Document viewed', application.currentStatus, application.currentStatus, `${document.documentType} document file viewed.`)
  })
}

export async function listHistory(applicationId: string, user: AuthUser) {
  const state = await getJsonState()
  const application = assertAccessible(state.applications.find((item) => item.applicationId === applicationId), user)
  return state.auditLogs
    .filter((entry) => entry.applicationId === application._id)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
      actor: state.users.find((candidate) => candidate._id === entry.actor)
        ? { _id: entry.actor, name: state.users.find((candidate) => candidate._id === entry.actor)!.name, role: state.users.find((candidate) => candidate._id === entry.actor)!.role }
        : { _id: entry.actor, name: 'Officer', role: 'FIELD_OFFICER' },
    }))
}

export async function listOfficers(district?: string) {
  const state = await getJsonState()
  return state.users
    .filter((user) => user.active && ['REVENUE_OFFICER', 'FIELD_OFFICER'].includes(user.role) && (!district || user.district === district))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ _id, name, role, district: officerDistrict }) => ({ _id, name, role, district: officerDistrict }))
}

export async function listUsers(query: { district?: string; role?: string; active?: boolean }) {
  const state = await getJsonState()
  return state.users
    .filter((user) => (!query.district || user.district === query.district)
      && (!query.role || user.role === query.role)
      && (query.active === undefined || user.active === query.active))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ _id, name, email, role, district, active }) => ({ _id, name, email, role, district, active }))
}

export async function createUser(input: { name: string; email: string; passwordHash: string; role: JsonUser['role']; district: string }) {
  return updateJsonState((state) => {
    if (state.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
      throw new HttpError(409, 'A user with this email already exists.', 'EMAIL_ALREADY_EXISTS')
    }
    const now = new Date().toISOString()
    const user: JsonUser = {
      _id: makeId(),
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      district: input.district,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    state.users.push(user)
    return user
  })
}

export async function updateUser(userId: string, update: { name?: string; role?: JsonUser['role']; district?: string; active?: boolean }) {
  return updateJsonState((state) => {
    const user = state.users.find((candidate) => candidate._id === userId)
    if (!user) throw new HttpError(404, 'User not found.', 'USER_NOT_FOUND')
    const removingActiveAdmin = user.role === 'ADMIN' && user.active
      && ((update.role !== undefined && update.role !== 'ADMIN') || update.active === false)
    if (removingActiveAdmin && !state.users.some((candidate) => candidate._id !== user._id && candidate.role === 'ADMIN' && candidate.active)) {
      throw new HttpError(409, 'At least one active administrator must remain.', 'LAST_ADMIN')
    }
    if (update.name !== undefined) user.name = update.name
    if (update.role !== undefined) user.role = update.role
    if (update.district !== undefined) user.district = update.district
    if (update.active !== undefined) user.active = update.active
    user.updatedAt = new Date().toISOString()
    return user
  })
}
