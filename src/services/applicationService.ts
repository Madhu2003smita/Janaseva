import { apiClient } from './apiClient'

export type WorkflowStatus =
  | 'Application received'
  | 'Document verification'
  | 'Field verification'
  | 'Final decision'
  | 'Returned for correction'
  | 'Approved'
  | 'Rejected'

export type ApplicationPriority = 'Low' | 'Normal' | 'High' | 'Urgent'
export type DocumentVerificationStatus = 'Pending' | 'Verified' | 'Needs correction'
export type DocumentCategory = 'identity' | 'address' | 'income' | 'ration' | 'supporting' | 'other'

export type ApplicationDocument = {
  id: string
  documentType: string
  name: string
  originalName?: string
  mimeType?: string
  size?: number
  uploadedAt?: string
  uploadStatus: 'Uploaded' | 'Missing'
  verificationStatus: DocumentVerificationStatus
  remarks: string
  required: boolean
  applicable: boolean
}

export type ApplicationHistoryEntry = {
  id: string
  timestamp: string
  actor: string
  actorRole?: 'ADMIN' | 'REVENUE_OFFICER' | 'FIELD_OFFICER'
  action: string
  description: string
  previousStatus?: WorkflowStatus
  newStatus?: WorkflowStatus
}

export type ApplicationRecord = {
  id: string
  name: string
  initials: string
  fatherOrGuardian: string
  address: string
  district: string
  block: string
  gramPanchayat: string
  annualIncome: number
  mobile: string
  submittedAt: string
  verificationRemarks: string
  assignedOfficer: string
  assignedOfficerId: string
  status: WorkflowStatus
  priority: ApplicationPriority
  color: string
  documents: ApplicationDocument[]
  fieldObservations: string
  history: ApplicationHistoryEntry[]
}

export type ApplicationFilters = {
  query?: string
  district?: string
  status?: WorkflowStatus | ''
  priority?: ApplicationPriority | ''
  submittedFrom?: string
  submittedTo?: string
}

export type ApplicationPageResult = {
  items: ApplicationRecord[]
  total: number
  pages: number
}

export type OfficerOption = {
  id: string
  name: string
  role: 'ADMIN' | 'REVENUE_OFFICER' | 'FIELD_OFFICER'
}
export type DashboardSummary = {
  total: number
  pending: number
  needsAttention: number
  approved: number
  rejected: number
  missingDocuments: number
  overdueFieldVerifications: number
  recentActivity: {
    id: string
    applicationId: string
    applicantName: string
    actor: string
    action: string
    timestamp: string
    remarks: string
  }[]
}

type RawOfficer = string | { _id?: string; id?: string; name?: string; role?: OfficerOption['role'] } | null
type RawDocument = {
  _id?: string
  documentType: string
  applicable: boolean
  required: boolean
  fileMetadata?: {
    originalName?: string
    mimeType?: string
    size?: number
    storageKey?: string
    uploadedAt?: string
  } | null
  verificationStatus: DocumentVerificationStatus
  officerRemarks?: string
}
type RawHistory = {
  _id?: string
  id?: string
  actor?: string | { name?: string; role?: ApplicationHistoryEntry['actorRole'] }
  actorRole?: ApplicationHistoryEntry['actorRole']
  action: string
  previousStatus?: WorkflowStatus
  newStatus?: WorkflowStatus
  remarks?: string
  timestamp: string
}
type RawApplication = {
  _id?: string
  applicationId: string
  applicant: { fullName: string; fatherOrGuardianName: string; mobile: string }
  address: { address: string; district: string; block: string; gramPanchayat: string }
  annualIncome: number
  submittedAt: string
  verificationRemarks?: string
  assignedOfficer?: RawOfficer
  currentStatus: WorkflowStatus
  priority: ApplicationPriority
  documents?: RawDocument[]
  fieldObservations?: string
}

const documentNames: Record<string, string> = {
  identity: 'Identity proof',
  address: 'Address proof',
  income: 'Income proof',
  other: 'Other documents',
  aadhaar: 'Aadhaar identification',
  ration: 'Ration card',
  declaration: 'Income declaration',
  salary: 'Salary certificate / income proof',
  supporting: 'Other supporting documents',
}
const avatarColors = ['rose', 'blue', 'amber', 'violet', 'green']
let cache: ApplicationRecord[] = []
const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach((listener) => listener())
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase()
}

function officerParts(value?: RawOfficer) {
  if (!value) return { id: '', name: 'Unassigned' }
  if (typeof value === 'string') return { id: value, name: 'Assigned officer' }
  return { id: value._id ?? value.id ?? '', name: value.name ?? 'Unassigned' }
}

function mapDocument(document: RawDocument): ApplicationDocument {
  return {
    id: document._id ?? document.documentType,
    documentType: document.documentType,
    name: documentNames[document.documentType] ?? document.documentType,
    originalName: document.fileMetadata?.originalName,
    mimeType: document.fileMetadata?.mimeType,
    size: document.fileMetadata?.size,
    uploadedAt: document.fileMetadata?.uploadedAt,
    uploadStatus: document.fileMetadata?.storageKey ? 'Uploaded' : 'Missing',
    verificationStatus: document.verificationStatus,
    remarks: document.officerRemarks ?? '',
    required: document.required,
    applicable: document.applicable,
  }
}

function mapApplication(application: RawApplication, index = 0): ApplicationRecord {
  const assignedOfficer = officerParts(application.assignedOfficer)
  return {
    id: application.applicationId,
    name: application.applicant.fullName,
    initials: initials(application.applicant.fullName),
    fatherOrGuardian: application.applicant.fatherOrGuardianName,
    address: application.address.address,
    district: application.address.district,
    block: application.address.block,
    gramPanchayat: application.address.gramPanchayat,
    annualIncome: application.annualIncome,
    mobile: application.applicant.mobile,
    submittedAt: application.submittedAt,
    verificationRemarks: application.verificationRemarks ?? '',
    assignedOfficer: assignedOfficer.name,
    assignedOfficerId: assignedOfficer.id,
    status: application.currentStatus,
    priority: application.priority,
    color: avatarColors[index % avatarColors.length] ?? 'blue',
    documents: application.documents?.map(mapDocument) ?? [],
    fieldObservations: application.fieldObservations ?? '',
    history: [],
  }
}

function replaceInCache(record: ApplicationRecord) {
  const existing = cache.findIndex((item) => item.id === record.id)
  if (existing < 0) cache = [record, ...cache]
  else cache = cache.map((item, index) => index === existing ? record : item)
  emitChange()
}

async function refreshDetails(id: string) {
  return applicationService.getById(id)
}

export const applicationService = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot() {
    return cache
  },

  clearCache() {
    cache = []
    emitChange()
  },

  async summary() {
    const result = await apiClient.request<{ summary: DashboardSummary }>('/applications/summary')
    return result.summary
  },

  async list(filters: ApplicationFilters = {}, page = 1, pageSize = 100): Promise<ApplicationPageResult> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (filters.query) params.set('search', filters.query)
    if (filters.district) params.set('district', filters.district)
    if (filters.status) params.set('status', filters.status)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.submittedFrom) params.set('submittedFrom', filters.submittedFrom)
    if (filters.submittedTo) params.set('submittedTo', filters.submittedTo)
    const result = await apiClient.request<{ items: RawApplication[]; pagination: { total: number; pages: number } }>(`/applications?${params}`)
    const items = result.items.map(mapApplication)
    cache = [...new Map([...cache, ...items].map((item) => [item.id, item])).values()]
    emitChange()
    return { items, total: result.pagination.total, pages: result.pagination.pages }
  },

  async getById(id: string): Promise<ApplicationRecord> {
    const [applicationResult, documentsResult, historyResult] = await Promise.all([
      apiClient.request<{ application: RawApplication }>(`/applications/${encodeURIComponent(id)}`),
      apiClient.request<{ documents: RawDocument[] }>(`/applications/${encodeURIComponent(id)}/documents`),
      apiClient.request<{ history: RawHistory[] }>(`/applications/${encodeURIComponent(id)}/history`),
    ])
    const record = mapApplication({ ...applicationResult.application, documents: documentsResult.documents })
    record.history = historyResult.history.map((entry) => ({
      id: entry._id ?? entry.id ?? `${entry.action}-${entry.timestamp}`,
      timestamp: entry.timestamp,
      actor: typeof entry.actor === 'string' ? entry.actor : entry.actor?.name ?? 'Officer',
      actorRole: entry.actorRole ?? (typeof entry.actor === 'object' ? entry.actor?.role : undefined),
      action: entry.action,
      description: entry.remarks ?? '',
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
    }))
    replaceInCache(record)
    return record
  },

  async create(input: {
    applicant: { fullName: string; fatherOrGuardianName: string; mobile: string }
    address: { address: string; district: string; block: string; gramPanchayat: string }
    annualIncome: number
    priority?: ApplicationPriority
  }) {
    const result = await apiClient.request<{ application: RawApplication }>('/applications', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return mapApplication(result.application)
  },

  async updateDocument(id: string, documentId: string, verificationStatus: DocumentVerificationStatus, remarks: string) {
    await apiClient.request(`/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationStatus, officerRemarks: remarks }),
    })
    return refreshDetails(id)
  },

  async uploadDocument(id: string, documentId: string, file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData()
    formData.set('documentId', documentId)
    formData.set('file', file)
    await apiClient.upload(`/applications/${encodeURIComponent(id)}/documents`, formData, onProgress)
    return refreshDetails(id)
  },

  async addDocumentWithFile(id: string, file: File, input: {
    documentType: DocumentCategory
    applicable: boolean
    required: boolean
  }, onProgress?: (progress: number) => void) {
    const formData = new FormData()
    formData.set('documentType', input.documentType)
    formData.set('applicable', String(input.applicable))
    formData.set('required', String(input.required))
    formData.set('file', file)
    await apiClient.upload(`/applications/${encodeURIComponent(id)}/documents`, formData, onProgress)
    return refreshDetails(id)
  },

  async deleteDocument(id: string, documentId: string) {
    await apiClient.request(`/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' })
    return refreshDetails(id)
  },

  getDocumentFile(documentId: string, inline = false) {
    const query = inline ? '?disposition=inline' : ''
    return apiClient.download(`/documents/${encodeURIComponent(documentId)}/download${query}`)
  },

  async startVerification(id: string) {
    await transition(id, 'start_verification')
    return refreshDetails(id)
  },

  async completeDocumentVerification(id: string) {
    await transition(id, 'complete_document_verification')
    return refreshDetails(id)
  },

  async requestMissingDocuments(id: string, remarks: string) {
    await transition(id, 'request_missing_documents', remarks)
    return refreshDetails(id)
  },

  async returnForCorrection(id: string, remarks: string) {
    await transition(id, 'return_for_correction', remarks)
    return refreshDetails(id)
  },

  async resubmit(id: string) {
    await transition(id, 'resubmit', '')
    return refreshDetails(id)
  },

  async startFieldVerification(id: string, remarks: string) {
    await transition(id, 'start_field_verification', remarks)
    return refreshDetails(id)
  },

  async completeFieldVerification(id: string, remarks: string) {
    await transition(id, 'complete_field_verification', remarks)
    return refreshDetails(id)
  },

  async saveFieldObservations(id: string, observations: string) {
    await apiClient.request(`/applications/${encodeURIComponent(id)}/field-observations`, {
      method: 'PATCH',
      body: JSON.stringify({ observations }),
    })
    return refreshDetails(id)
  },

  async decide(id: string, decision: 'approve' | 'reject', remarks: string) {
    await transition(id, decision, remarks)
    return refreshDetails(id)
  },

  async listOfficers() {
    const result = await apiClient.request<{ officers: { _id: string; name: string; role: OfficerOption['role'] }[] }>('/users/officers')
    return result.officers.map((officer) => ({ id: officer._id, name: officer.name, role: officer.role }))
  },

  async assignOfficer(id: string, officerId: string) {
    await apiClient.request(`/applications/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ officerId }),
    })
    return refreshDetails(id)
  },
}

async function transition(id: string, action: string, remarks = '') {
  return apiClient.request(`/applications/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ action, remarks }),
  })
}
