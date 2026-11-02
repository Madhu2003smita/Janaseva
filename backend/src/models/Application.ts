import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose'

export const workflowStatuses = [
  'Application received',
  'Document verification',
  'Field verification',
  'Final decision',
  'Returned for correction',
  'Approved',
  'Rejected',
] as const
export const priorities = ['Low', 'Normal', 'High', 'Urgent'] as const
export const documentStatuses = ['Pending', 'Verified', 'Needs correction'] as const
export const documentTypes = ['identity', 'address', 'income', 'ration', 'supporting', 'other', 'aadhaar', 'declaration', 'salary'] as const
export type WorkflowStatus = typeof workflowStatuses[number]
export type ApplicationPriority = typeof priorities[number]
export type DocumentVerificationStatus = typeof documentStatuses[number]
export type DocumentUploadMetadata = {
  originalName: string
  mimeType: string
  size: number
  storageKey: string
  uploadedAt: string
}

const fileMetadataSchema = new Schema({
  originalName: { type: String, trim: true, maxlength: 255 },
  mimeType: { type: String, trim: true, maxlength: 120 },
  size: { type: Number, min: 0, max: 25 * 1024 * 1024 },
  storageKey: { type: String, trim: true, maxlength: 500 },
  uploadedAt: { type: Date },
}, { _id: false })

const documentSchema = new Schema({
  documentType: { type: String, enum: documentTypes, required: true },
  applicable: { type: Boolean, required: true, default: true },
  required: { type: Boolean, required: true, default: false },
  fileMetadata: { type: fileMetadataSchema, default: undefined },
  verificationStatus: { type: String, enum: documentStatuses, required: true, default: 'Pending' },
  officerRemarks: { type: String, trim: true, maxlength: 2000, default: '' },
}, { timestamps: true })

const applicantSchema = new Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
  fatherOrGuardianName: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
  mobile: { type: String, required: true, trim: true, match: /^\+?[0-9 ]{10,16}$/ },
}, { _id: false })

const addressSchema = new Schema({
  address: { type: String, required: true, trim: true, maxlength: 500 },
  district: { type: String, required: true, trim: true, maxlength: 100, index: true },
  block: { type: String, required: true, trim: true, maxlength: 100 },
  gramPanchayat: { type: String, required: true, trim: true, maxlength: 120 },
}, { _id: false })

const applicationSchema = new Schema({
  applicationId: { type: String, required: true, unique: true, index: true, trim: true },
  applicant: { type: applicantSchema, required: true },
  address: { type: addressSchema, required: true },
  annualIncome: { type: Number, required: true, min: 0, max: 100000000 },
  submittedAt: { type: Date, required: true, default: Date.now, index: true },
  assignedOfficer: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  currentStatus: { type: String, enum: workflowStatuses, required: true, default: 'Application received', index: true },
  priority: { type: String, enum: priorities, required: true, default: 'Normal', index: true },
  documents: { type: [documentSchema], default: [] },
  verificationRemarks: { type: String, trim: true, maxlength: 5000, default: '' },
  fieldObservations: { type: String, trim: true, maxlength: 5000, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, versionKey: false })

applicationSchema.index({ 'applicant.fullName': 'text', applicationId: 'text' })
applicationSchema.index({ 'address.district': 1, currentStatus: 1, priority: 1, submittedAt: -1 })

export type ApplicationDocumentRecord = InferSchemaType<typeof applicationSchema>
export type ApplicationEntity = HydratedDocument<ApplicationDocumentRecord>
export const Application = model('Application', applicationSchema)
