import bcrypt from 'bcryptjs'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { Application } from './models/Application.js'
import { AuditLog } from './models/AuditLog.js'
import { User } from './models/User.js'

const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'JanaSevaDemo#2026'

const userSeeds = [
  { name: 'Sanjay Patnaik', email: 'admin@janaseva.local', role: 'ADMIN', district: 'Khordha' },
  { name: 'Ananya Mishra', email: 'revenue@janaseva.local', role: 'REVENUE_OFFICER', district: 'Khordha' },
  { name: 'Bikash Das', email: 'field@janaseva.local', role: 'FIELD_OFFICER', district: 'Khordha' },
] as const

async function seed() {
  await connectDatabase()
  const passwordHash = await bcrypt.hash(demoPassword, 12)
  const users = new Map<string, string>()
  for (const user of userSeeds) {
    const stored = await User.findOneAndUpdate(
      { email: user.email },
      { $set: { ...user, passwordHash, active: true } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    users.set(user.email, stored.id)
  }

  const revenueId = users.get('revenue@janaseva.local')!
  const fieldId = users.get('field@janaseva.local')!
  const adminId = users.get('admin@janaseva.local')!
  const samples = [
    {
      applicationId: 'INC-2026-0842',
      applicant: { fullName: 'Sabitri Pradhan', fatherOrGuardianName: 'Bansidhar Pradhan', mobile: '+91 90000 10042' },
      address: { address: 'Village: Jatni, Ward No. 8', district: 'Khordha', block: 'Jatni', gramPanchayat: 'Jatni' },
      annualIncome: 96000, assignedOfficer: revenueId, currentStatus: 'Document verification', priority: 'Urgent',
      documents: [
        { documentType: 'aadhaar', applicable: true, required: true, verificationStatus: 'Pending', fileMetadata: { originalName: 'sample-aadhaar.pdf', mimeType: 'application/pdf', size: 1200, storageKey: 'seed://fictional/aadhaar', uploadedAt: new Date('2026-11-01T10:42:00Z') } },
        { documentType: 'ration', applicable: true, required: true, verificationStatus: 'Verified', officerRemarks: 'Name matches application.', fileMetadata: { originalName: 'sample-ration.pdf', mimeType: 'application/pdf', size: 1400, storageKey: 'seed://fictional/ration', uploadedAt: new Date('2026-11-01T10:42:00Z') } },
        { documentType: 'declaration', applicable: true, required: true, verificationStatus: 'Needs correction', officerRemarks: 'Applicant signature is unclear.', fileMetadata: { originalName: 'sample-declaration.pdf', mimeType: 'application/pdf', size: 1100, storageKey: 'seed://fictional/declaration', uploadedAt: new Date('2026-11-01T10:42:00Z') } },
        { documentType: 'salary', applicable: false, required: false, verificationStatus: 'Pending' },
        { documentType: 'supporting', applicable: true, required: false, verificationStatus: 'Pending', fileMetadata: { originalName: 'sample-support.pdf', mimeType: 'application/pdf', size: 900, storageKey: 'seed://fictional/supporting', uploadedAt: new Date('2026-11-01T10:42:00Z') } },
      ],
      submittedAt: new Date('2026-11-01T10:42:00Z'), createdBy: revenueId,
    },
    {
      applicationId: 'INC-2026-0841',
      applicant: { fullName: 'Rakesh Kumar Sahu', fatherOrGuardianName: 'Prasanna Kumar Sahu', mobile: '+91 90000 10041' },
      address: { address: 'Village: Niali, Near High School', district: 'Khordha', block: 'Niali', gramPanchayat: 'Niali' },
      annualIncome: 128000, assignedOfficer: fieldId, currentStatus: 'Field verification', priority: 'High',
      documents: ['aadhaar', 'ration', 'declaration'].map((documentType) => ({
        documentType, applicable: true, required: true, verificationStatus: 'Verified',
        fileMetadata: { originalName: `sample-${documentType}.pdf`, mimeType: 'application/pdf', size: 1000, storageKey: `seed://fictional/${documentType}`, uploadedAt: new Date('2026-11-01T09:18:00Z') },
      })),
      submittedAt: new Date('2026-11-01T09:18:00Z'), createdBy: revenueId,
    },
    {
      applicationId: 'INC-2026-0840',
      applicant: { fullName: 'Manoj Nayak', fatherOrGuardianName: 'Gopinath Nayak', mobile: '+91 90000 10040' },
      address: { address: 'Village: Satyabadi, Main Road', district: 'Puri', block: 'Satyabadi', gramPanchayat: 'Sakshigopal' },
      annualIncome: 84000, currentStatus: 'Application received', priority: 'Normal',
      documents: ['aadhaar', 'ration', 'declaration', 'salary', 'supporting'].map((documentType) => ({
        documentType, applicable: ['aadhaar', 'ration', 'declaration'].includes(documentType),
        required: ['aadhaar', 'ration', 'declaration'].includes(documentType), verificationStatus: 'Pending',
      })),
      submittedAt: new Date('2026-11-01T08:56:00Z'), createdBy: adminId,
    },
  ]

  for (const sample of samples) {
    const record = await Application.findOneAndUpdate(
      { applicationId: sample.applicationId },
      { $setOnInsert: sample },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    const existingAudit = await AuditLog.exists({ applicationId: record._id })
    if (!existingAudit) {
      await AuditLog.create({
        applicationId: record._id,
        actor: revenueId,
        action: 'Application submitted',
        newStatus: record.currentStatus,
        remarks: 'Fictional sample application added by the seed script.',
        timestamp: record.submittedAt,
      })
    }
  }
  console.info(`Seeded ${userSeeds.length} demo users and ${samples.length} fictional applications.`)
}

seed().catch((error: unknown) => {
  console.error('Unable to seed JanaSeva demo data:', error)
  process.exitCode = 1
}).finally(async () => {
  await disconnectDatabase()
})
