import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Check, Clock3, FileCheck2, FileText, Printer, ShieldCheck } from 'lucide-react'
import { aiService, type ApplicationSummary } from './services/aiService'
import { applicationService, type ApplicationHistoryEntry, type WorkflowStatus } from './services/applicationService'
import { useAuth } from './useAuth'
import './FinalReview.css'

type Language = 'en' | 'or'

const copy = {
  en: {
    title: 'Final Review', back: 'Back to application', applicantInformation: 'Applicant information',
    applicationId: 'Application ID', applicant: 'Applicant', guardian: 'Father / guardian',
    submitted: 'Submission date', address: 'Address', district: 'District', block: 'Block',
    gramPanchayat: 'Gram Panchayat', income: 'Annual family income declared', status: 'Workflow status',
    documents: 'Document verification results', required: 'Required', optional: 'Optional',
    applicable: 'Applicable', notApplicable: 'Not applicable', uploaded: 'Uploaded', missing: 'Missing',
    verified: 'Verified', pending: 'Pending', needsCorrection: 'Needs correction',
    fieldVerification: 'Field verification observations', noObservations: 'No field observations recorded.',
    outstanding: 'Outstanding issues', noIssues: 'No outstanding verification items recorded.',
    incomplete: 'Verification is incomplete. Final decisions are blocked until all configured required documents are verified and field observations are recorded.',
    officerRemarks: 'Officer remarks and correction instructions', history: 'Decision History',
    historySub: 'Chronological, read-only record of application and decision actions.',
    approve: 'Approve', reject: 'Reject', return: 'Return for Correction',
    decisionRemarks: 'Decision remarks', returnInstructions: 'Missing information or correction instructions',
    remarksPlaceholder: 'Enter the reason for this decision…',
    returnPlaceholder: 'Specify the missing information or corrections required…',
    requiredRemarks: 'Decision remarks are required.', requiredReturn: 'Correction instructions are required.',
    confirmApprove: 'Confirm approval of this application? This records a final officer decision.',
    confirmReject: 'Confirm rejection of this application? This records a final officer decision.',
    confirmReturn: 'Return this application for correction with the instructions entered?',
    successApprove: 'Application approved and decision recorded.',
    successReject: 'Application rejected and decision recorded.',
    successReturn: 'Application returned for correction.',
    error: 'The requested action could not be completed.',
    authorizedOnly: 'Only an administrator or revenue officer may make a final decision.',
    finalOnly: 'A final decision is available only after field verification is complete.',
    print: 'Print decision summary', aiTitle: 'AI-generated application summary',
    aiGenerate: 'Generate AI summary', aiBusy: 'Generating summary…', aiFailed: 'AI summary is unavailable.',
    aiNotice: 'AI findings are shown separately. Neither AI output nor confidence is a decision or proof of eligibility. Review all evidence yourself.',
    decisionSummary: 'JanaSeva decision summary', decision: 'Decision', decisionDate: 'Decision date',
    officer: 'Officer', role: 'Role', remarks: 'Decision remarks',
    noDecision: 'No final decision has been recorded.', notCertificate: 'Administrative decision record only. This is not an income certificate or a government-issued certificate.',
    administration: 'Administrative review workspace', missingRole: 'Officer role not recorded',
    role_ADMIN: 'Administrator', role_REVENUE_OFFICER: 'Revenue Officer', role_FIELD_OFFICER: 'Field Officer',
  },
  or: {
    title: 'ଚୂଡ଼ାନ୍ତ ସମୀକ୍ଷା', back: 'ଆବେଦନକୁ ଫେରନ୍ତୁ', applicantInformation: 'ଆବେଦନକାରୀଙ୍କ ସୂଚନା',
    applicationId: 'ଆବେଦନ ID', applicant: 'ଆବେଦନକାରୀ', guardian: 'ପିତା / ଅଭିଭାବକ',
    submitted: 'ଦାଖଲ ତାରିଖ', address: 'ଠିକଣା', district: 'ଜିଲ୍ଲା', block: 'ବ୍ଲକ',
    gramPanchayat: 'ଗ୍ରାମ ପଞ୍ଚାୟତ', income: 'ଘୋଷିତ ବାର୍ଷିକ ପରିବାର ଆୟ', status: 'କାର୍ଯ୍ୟଧାରାର ସ୍ଥିତି',
    documents: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ଫଳାଫଳ', required: 'ଆବଶ୍ୟକ', optional: 'ଇଚ୍ଛାଧୀନ',
    applicable: 'ପ୍ରଯୁଜ୍ୟ', notApplicable: 'ପ୍ରଯୁଜ୍ୟ ନୁହେଁ', uploaded: 'ଅପଲୋଡ୍ ହୋଇଛି', missing: 'ଅନୁପସ୍ଥିତ',
    verified: 'ଯାଞ୍ଚ ହୋଇଛି', pending: 'ଅପେକ୍ଷାରେ', needsCorrection: 'ସଂଶୋଧନ ଆବଶ୍ୟକ',
    fieldVerification: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ପର୍ଯ୍ୟବେକ୍ଷଣ', noObservations: 'କୌଣସି କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ରେକର୍ଡ ହୋଇନାହିଁ।',
    outstanding: 'ବାକି ଥିବା ସମସ୍ୟା', noIssues: 'କୌଣସି ବାକି ଯାଞ୍ଚ ସମସ୍ୟା ରେକର୍ଡ ହୋଇନାହିଁ।',
    incomplete: 'ଯାଞ୍ଚ ଅସମ୍ପୂର୍ଣ୍ଣ। ସମସ୍ତ ନିର୍ଦ୍ଧାରିତ ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ଯାଞ୍ଚ ଏବଂ କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ରେକର୍ଡ ହେବା ପର୍ଯ୍ୟନ୍ତ ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ହୋଇପାରିବ ନାହିଁ।',
    officerRemarks: 'ଅଧିକାରୀଙ୍କ ମତାମତ ଏବଂ ସଂଶୋଧନ ନିର୍ଦ୍ଦେଶ', history: 'ନିଷ୍ପତ୍ତି ଇତିହାସ',
    historySub: 'ଆବେଦନ ଓ ନିଷ୍ପତ୍ତି କାର୍ଯ୍ୟର କ୍ରମାନୁସାରୀ, କେବଳ-ପଠନଯୋଗ୍ୟ ରେକର୍ଡ।',
    approve: 'ଅନୁମୋଦନ', reject: 'ପ୍ରତ୍ୟାଖ୍ୟାନ', return: 'ସଂଶୋଧନ ପାଇଁ ଫେରାନ୍ତୁ',
    decisionRemarks: 'ନିଷ୍ପତ୍ତି ସମ୍ବନ୍ଧୀୟ ମତାମତ', returnInstructions: 'ଆବଶ୍ୟକ ସୂଚନା କିମ୍ବା ସଂଶୋଧନ ନିର୍ଦ୍ଦେଶ',
    remarksPlaceholder: 'ଏହି ନିଷ୍ପତ୍ତିର କାରଣ ଲେଖନ୍ତୁ…',
    returnPlaceholder: 'ଆବଶ୍ୟକ ସୂଚନା କିମ୍ବା ସଂଶୋଧନ ସ୍ପଷ୍ଟ କରନ୍ତୁ…',
    requiredRemarks: 'ନିଷ୍ପତ୍ତି ସମ୍ବନ୍ଧୀୟ ମତାମତ ଆବଶ୍ୟକ।', requiredReturn: 'ସଂଶୋଧନ ନିର୍ଦ୍ଦେଶ ଆବଶ୍ୟକ।',
    confirmApprove: 'ଏହି ଆବେଦନକୁ ଅନୁମୋଦନ କରିବେ କି? ଏହା ଅଧିକାରୀଙ୍କ ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ଭାବେ ରେକର୍ଡ ହେବ।',
    confirmReject: 'ଏହି ଆବେଦନକୁ ପ୍ରତ୍ୟାଖ୍ୟାନ କରିବେ କି? ଏହା ଅଧିକାରୀଙ୍କ ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ଭାବେ ରେକର୍ଡ ହେବ।',
    confirmReturn: 'ଲେଖାଯାଇଥିବା ନିର୍ଦ୍ଦେଶ ସହ ଏହି ଆବେଦନକୁ ସଂଶୋଧନ ପାଇଁ ଫେରାଇବେ କି?',
    successApprove: 'ଆବେଦନ ଅନୁମୋଦିତ ଏବଂ ନିଷ୍ପତ୍ତି ରେକର୍ଡ ହୋଇଛି।',
    successReject: 'ଆବେଦନ ପ୍ରତ୍ୟାଖ୍ୟାନ ଏବଂ ନିଷ୍ପତ୍ତି ରେକର୍ଡ ହୋଇଛି।',
    successReturn: 'ଆବେଦନ ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି।',
    error: 'ଅନୁରୋଧ କରାଯାଇଥିବା କାର୍ଯ୍ୟ ସମାପ୍ତ ହୋଇପାରିଲା ନାହିଁ।',
    authorizedOnly: 'କେବଳ ପ୍ରଶାସକ କିମ୍ବା ରାଜସ୍ୱ ଅଧିକାରୀ ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ନେଇପାରିବେ।',
    finalOnly: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ସମାପ୍ତ ହେବା ପରେ ମାତ୍ର ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ହୋଇପାରିବ।',
    print: 'ନିଷ୍ପତ୍ତି ସାରାଂଶ ପ୍ରିଣ୍ଟ କରନ୍ତୁ', aiTitle: 'AI-ସୃଷ୍ଟ ଆବେଦନ ସାରାଂଶ',
    aiGenerate: 'AI ସାରାଂଶ ସୃଷ୍ଟି କରନ୍ତୁ', aiBusy: 'ସାରାଂଶ ସୃଷ୍ଟି ହେଉଛି…', aiFailed: 'AI ସାରାଂଶ ଉପଲବ୍ଧ ନାହିଁ।',
    aiNotice: 'AI ତଥ୍ୟ ଅଲଗା ଭାବେ ଦର୍ଶାଯାଇଛି। AI ଫଳାଫଳ କିମ୍ବା ଏହାର ବିଶ୍ୱାସ ସ୍ତର ନିଷ୍ପତ୍ତି ନୁହେଁ ଏବଂ ଯୋଗ୍ୟତାର ପ୍ରମାଣ ନୁହେଁ। ସମସ୍ତ ପ୍ରମାଣ ନିଜେ ଯାଞ୍ଚ କରନ୍ତୁ।',
    decisionSummary: 'ଜନସେବା ନିଷ୍ପତ୍ତି ସାରାଂଶ', decision: 'ନିଷ୍ପତ୍ତି', decisionDate: 'ନିଷ୍ପତ୍ତି ତାରିଖ',
    officer: 'ଅଧିକାରୀ', role: 'ଭୂମିକା', remarks: 'ନିଷ୍ପତ୍ତି ସମ୍ବନ୍ଧୀୟ ମତାମତ',
    noDecision: 'କୌଣସି ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ରେକର୍ଡ ହୋଇନାହିଁ।',
    notCertificate: 'କେବଳ ପ୍ରଶାସନିକ ନିଷ୍ପତ୍ତି ରେକର୍ଡ। ଏହା ଆୟ ପ୍ରମାଣପତ୍ର କିମ୍ବା ସରକାରୀ ଭାବେ ଜାରି ପ୍ରମାଣପତ୍ର ନୁହେଁ।',
    administration: 'ପ୍ରଶାସନିକ ସମୀକ୍ଷା କାର୍ଯ୍ୟକ୍ଷେତ୍ର', missingRole: 'ଅଧିକାରୀଙ୍କ ଭୂମିକା ରେକର୍ଡ ହୋଇନାହିଁ',
    role_ADMIN: 'ପ୍ରଶାସକ', role_REVENUE_OFFICER: 'ରାଜସ୍ୱ ଅଧିକାରୀ', role_FIELD_OFFICER: 'କ୍ଷେତ୍ର ଅଧିକାରୀ',
  },
} as const satisfies Record<Language, Record<string, string>>

const workflowErrors: Record<string, Record<Language, string>> = {
  FINAL_DECISION_FORBIDDEN: { en: 'Only an administrator or revenue officer may record the final decision.', or: 'କେବଳ ପ୍ରଶାସକ କିମ୍ବା ରାଜସ୍ୱ ଅଧିକାରୀ ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ରେକର୍ଡ କରିପାରିବେ।' },
  INVALID_TRANSITION: { en: 'This action is not valid at the current workflow stage.', or: 'ବର୍ତ୍ତମାନ କାର୍ଯ୍ୟଧାରା ପର୍ଯ୍ୟାୟରେ ଏହି କାର୍ଯ୍ୟ ବୈଧ ନୁହେଁ।' },
  DOCUMENTS_INCOMPLETE: { en: 'Verify all applicable required documents before finalizing.', or: 'ଚୂଡ଼ାନ୍ତ କରିବା ପୂର୍ବରୁ ସମସ୍ତ ପ୍ରଯୁଜ୍ୟ ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ଯାଞ୍ଚ କରନ୍ତୁ।' },
  FIELD_VERIFICATION_INCOMPLETE: { en: 'Record field verification observations before finalizing.', or: 'ଚୂଡ଼ାନ୍ତ କରିବା ପୂର୍ବରୁ କ୍ଷେତ୍ର ଯାଞ୍ଚ ପର୍ଯ୍ୟବେକ୍ଷଣ ରେକର୍ଡ କରନ୍ତୁ।' },
  REMARKS_REQUIRED: { en: 'Decision remarks or correction instructions are required.', or: 'ନିଷ୍ପତ୍ତି ମତାମତ କିମ୍ବା ସଂଶୋଧନ ନିର୍ଦ୍ଦେଶ ଆବଶ୍ୟକ।' },
  FORBIDDEN: { en: 'Your role is not authorized to perform this action.', or: 'ଏହି କାର୍ଯ୍ୟ କରିବାକୁ ଆପଣଙ୍କ ଭୂମିକାକୁ ଅନୁମତି ନାହିଁ।' },
}

function requestError(error: unknown, language: Language, fallback: string) {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    const translated = workflowErrors[error.code]?.[language]
    if (translated) return translated
  }
  return error instanceof Error ? error.message : fallback
}

function dateLabel(value: string, language: Language, includeTime = false) {
  return new Intl.DateTimeFormat(language === 'or' ? 'or-IN' : 'en-IN', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(value))
}

function workflowLabel(status: WorkflowStatus, language: Language) {
  const labels: Record<WorkflowStatus, string> = {
    'Application received': language === 'or' ? 'ଆବେଦନ ଗ୍ରହଣ ହୋଇଛି' : 'Application received',
    'Document verification': language === 'or' ? 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ' : 'Document verification',
    'Field verification': language === 'or' ? 'କ୍ଷେତ୍ର ଯାଞ୍ଚ' : 'Field verification',
    'Final decision': language === 'or' ? 'ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି' : 'Final decision',
    'Returned for correction': language === 'or' ? 'ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି' : 'Returned for correction',
    Approved: language === 'or' ? 'ଅନୁମୋଦିତ' : 'Approved',
    Rejected: language === 'or' ? 'ପ୍ରତ୍ୟାଖ୍ୟାନ' : 'Rejected',
  }
  return labels[status]
}

function roleLabel(role: ApplicationHistoryEntry['actorRole'], language: Language) {
  if (!role) return copy[language].missingRole
  const key = `role_${role}` as const
  return copy[language][key]
}

function documentLabel(name: string, language: Language) {
  if (language === 'en') return name
  const labels: Record<string, string> = {
    'Identity proof': 'ପରିଚୟ ପ୍ରମାଣ',
    'Address proof': 'ଠିକଣା ପ୍ରମାଣ',
    'Income proof': 'ଆୟ ପ୍ରମାଣ',
    'Other documents': 'ଅନ୍ୟାନ୍ୟ ଦସ୍ତାବିଜ',
    'Aadhaar identification': 'ଆଧାର ପରିଚୟ ପତ୍ର',
    'Ration card': 'ରାସନ କାର୍ଡ',
    'Income declaration': 'ଆୟ ଘୋଷଣାପତ୍ର',
    'Salary certificate / income proof': 'ଦରମା ପ୍ରମାଣପତ୍ର / ଆୟ ପ୍ରମାଣ',
    'Other supporting documents': 'ଅନ୍ୟାନ୍ୟ ସହାୟକ ଦସ୍ତାବିଜ',
  }
  return labels[name] ?? name
}

function actionLabel(action: string, language: Language) {
  const labels: Record<string, Record<Language, string>> = {
    'Application submitted': { en: 'Application submitted', or: 'ଆବେଦନ ଦାଖଲ ହୋଇଛି' },
    'Application assigned': { en: 'Application assigned', or: 'ଆବେଦନ ନିଯୁକ୍ତ ହୋଇଛି' },
    'Document verification started': { en: 'Document verification started', or: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ଆରମ୍ଭ ହୋଇଛି' },
    'Documents verified': { en: 'Documents verified', or: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ହୋଇଛି' },
    'Application returned': { en: 'Application returned for correction', or: 'ଆବେଦନ ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି' },
    'Application resubmitted': { en: 'Application resubmitted', or: 'ଆବେଦନ ପୁନଃଦାଖଲ ହୋଇଛି' },
    'Application approved': { en: 'Application approved', or: 'ଆବେଦନ ଅନୁମୋଦିତ ହୋଇଛି' },
    'Application rejected': { en: 'Application rejected', or: 'ଆବେଦନ ପ୍ରତ୍ୟାଖ୍ୟାନ ହୋଇଛି' },
    'Field verification started': { en: 'Field verification started', or: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ଆରମ୍ଭ ହୋଇଛି' },
    'Field verification completed': { en: 'Field verification completed', or: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ସମାପ୍ତ ହୋଇଛି' },
    'Field observations recorded': { en: 'Field observations recorded', or: 'କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ରେକର୍ଡ ହୋଇଛି' },
    'Missing documents requested': { en: 'Missing documents requested', or: 'ଅନୁପସ୍ଥିତ ଦସ୍ତାବିଜ ମଗାଯାଇଛି' },
    'Document verified': { en: 'Document verified', or: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ହୋଇଛି' },
    'Document returned for correction': { en: 'Document returned for correction', or: 'ଦସ୍ତାବିଜ ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି' },
    'Document check updated': { en: 'Document check updated', or: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ଅପଡେଟ୍ ହୋଇଛି' },
    'AI application review summary generated': { en: 'AI application review summary generated', or: 'AI ଆବେଦନ ସମୀକ୍ଷା ସାରାଂଶ ସୃଷ୍ଟି ହୋଇଛି' },
    'AI document review generated': { en: 'AI document review generated', or: 'AI ଦସ୍ତାବିଜ ଯାଞ୍ଚ ସୃଷ୍ଟି ହୋଇଛି' },
  }
  return labels[action]?.[language] ?? action
}

export function FinalReviewPage({ language }: { language: Language }) {
  const t = copy[language]
  const { applicationId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const applications = useSyncExternalStore(applicationService.subscribe, applicationService.getSnapshot, applicationService.getSnapshot)
  const application = applications.find((item) => item.id === applicationId)
  const [loadState, setLoadState] = useState<{ applicationId: string; status: 'loading' | 'loaded' | 'error' }>({
    applicationId,
    status: 'loading',
  })
  const loading = loadState.applicationId !== applicationId || loadState.status === 'loading'
  const loadError = loadState.applicationId === applicationId && loadState.status === 'error'
  const [remarks, setRemarks] = useState('')
  const [returnInstructions, setReturnInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [aiSummary, setAiSummary] = useState<ApplicationSummary | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    let active = true
    applicationService.getById(applicationId).then(() => {
      if (active) setLoadState({ applicationId, status: 'loaded' })
    }).catch(() => {
      if (active) setLoadState({ applicationId, status: 'error' })
    })
    return () => { active = false }
  }, [applicationId])

  const canDecide = user?.role === 'ADMIN' || user?.role === 'REVENUE_OFFICER'
  const requiredIncomplete = application?.documents.some((document) =>
    document.applicable && document.required
      && (document.uploadStatus !== 'Uploaded' || document.verificationStatus !== 'Verified'),
  ) ?? false
  const fieldVerificationIncomplete = !application?.fieldObservations.trim()
  const outstandingIssues = useMemo(() => {
    if (!application) return []
    const issues = application.documents
      .filter((document) => document.applicable && document.required
        && (document.uploadStatus !== 'Uploaded' || document.verificationStatus !== 'Verified'))
    return [...issues, ...(!application.fieldObservations.trim() ? [null] : [])]
  }, [application])
  const finalDecision = application?.status === 'Approved' || application?.status === 'Rejected'
    ? application.history.find((entry) => entry.action === `Application ${application.status.toLowerCase()}`)
    : undefined

  const submitDecision = async (action: 'approve' | 'reject' | 'return_for_correction') => {
    const reason = (action === 'return_for_correction' ? returnInstructions : remarks).trim()
    if (!reason) {
      setFeedback({ type: 'error', message: action === 'return_for_correction' ? t.requiredReturn : t.requiredRemarks })
      return
    }
    const confirmation = action === 'approve' ? t.confirmApprove
      : action === 'reject' ? t.confirmReject : t.confirmReturn
    if (!window.confirm(confirmation)) return
    setSaving(true)
    setFeedback(null)
    try {
      if (action === 'return_for_correction') {
        await applicationService.returnForCorrection(applicationId, reason)
        setFeedback({ type: 'success', message: t.successReturn })
      } else {
        await applicationService.decide(applicationId, action, reason)
        setFeedback({ type: 'success', message: action === 'approve' ? t.successApprove : t.successReject })
      }
      if (action === 'return_for_correction') setReturnInstructions('')
      else setRemarks('')
    } catch (error) {
      setFeedback({ type: 'error', message: requestError(error, language, t.error) })
    } finally {
      setSaving(false)
    }
  }

  const generateAiSummary = async () => {
    setAiBusy(true)
    setAiError('')
    try {
      const result = await aiService.generateApplicationSummary({ applicationId, language })
      setAiSummary(result)
      await applicationService.getById(applicationId)
    } catch (error) {
      setAiError(requestError(error, language, t.aiFailed))
    } finally {
      setAiBusy(false)
    }
  }

  if (loading) return <div className="content final-review-content"><div className="panel final-review-loading">{language === 'or' ? 'ଆବେଦନ ଲୋଡ୍ ହେଉଛି…' : 'Loading application…'}</div></div>
  if (loadError || !application) {
    return (
      <div className="content final-review-content">
        <div className="panel final-review-error"><AlertCircle size={20} /><strong>{language === 'or' ? 'ଆବେଦନ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।' : 'Unable to load this application.'}</strong><button className="secondary-button" onClick={() => navigate('/applications')}><ArrowLeft size={15} />{t.back}</button></div>
      </div>
    )
  }

  const isDecisionStage = application.status === 'Final decision'
  const decisionAllowed = canDecide && isDecisionStage && !requiredIncomplete && !fieldVerificationIncomplete
  const currency = new Intl.NumberFormat(language === 'or' ? 'or-IN' : 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(application.annualIncome)
  const decisionLabel = workflowLabel(application.status, language)
  const documentStatusLabel = (status: string) => status === 'Verified' ? t.verified : status === 'Needs correction' ? t.needsCorrection : t.pending

  return (
    <div className="content final-review-content">
      <div className="final-review-toolbar review-no-print">
        <button className="back-link" onClick={() => navigate(`/applications/${encodeURIComponent(application.id)}`)}><ArrowLeft size={15} />{t.back}</button>
        <span className="management-breadcrumb"><Link to="/">{t.administration}</Link> / {application.id}</span>
      </div>
      <header className="final-review-heading panel">
        <div><span className="final-review-kicker"><ShieldCheck size={15} />{t.administration}</span><h1>{t.title}</h1><p>{t.applicationId}: <strong>{application.id}</strong></p></div>
        <span className={`management-status status-${application.status.toLowerCase().replaceAll(' ', '-')}`}>{decisionLabel}</span>
      </header>

      <div className="final-review-grid">
        <main className="final-review-main">
          <section className="panel final-review-section">
            <div className="final-review-section-heading"><FileText size={17} /><h2>{t.applicantInformation}</h2></div>
            <div className="final-review-information">
              <Info label={t.applicant} value={application.name} />
              <Info label={t.guardian} value={application.fatherOrGuardian} />
              <Info label={t.applicationId} value={application.id} />
              <Info label={t.submitted} value={dateLabel(application.submittedAt, language)} />
              <Info label={t.address} value={application.address} />
              <Info label={t.district} value={application.district} />
              <Info label={t.block} value={application.block} />
              <Info label={t.gramPanchayat} value={application.gramPanchayat} />
              <Info label={t.income} value={currency} />
              <Info label={t.status} value={decisionLabel} />
            </div>
          </section>

          <section className="panel final-review-section">
            <div className="final-review-section-heading"><FileCheck2 size={17} /><h2>{t.documents}</h2></div>
            {application.documents.length
              ? <div className="review-document-list">{application.documents.map((document) => (
                <article className="review-document" key={document.id}>
                  <div><strong>{documentLabel(document.name, language)}</strong><small>{document.required ? t.required : t.optional} · {document.applicable ? t.applicable : t.notApplicable}</small></div>
                  <span>{document.uploadStatus === 'Uploaded' ? t.uploaded : t.missing}</span>
                  <span className={document.verificationStatus === 'Verified' ? 'review-verified' : 'review-incomplete'}>{documentStatusLabel(document.verificationStatus)}</span>
                  {document.remarks && <p>{document.remarks}</p>}
                </article>
              ))}</div>
              : <p className="final-review-muted">{t.noIssues}</p>}
          </section>

          <section className="panel final-review-section">
            <div className="final-review-section-heading"><FileCheck2 size={17} /><h2>{t.fieldVerification}</h2></div>
            {application.fieldObservations.trim()
              ? <p className="review-observations">{application.fieldObservations}</p>
              : <p className="review-incomplete"><AlertCircle size={15} />{t.noObservations}</p>}
          </section>

          <section className="panel final-review-section">
            <div className="final-review-section-heading"><AlertCircle size={17} /><h2>{t.outstanding}</h2></div>
            {outstandingIssues.length
              ? <div className="review-incomplete review-incomplete-box"><AlertCircle size={16} /><div><strong>{t.incomplete}</strong><ul>{outstandingIssues.map((document) => document
                ? <li key={document.id}>{documentLabel(document.name, language)}: {document.uploadStatus !== 'Uploaded' ? t.missing : documentStatusLabel(document.verificationStatus)}</li>
                : <li key="field-observations">{t.noObservations}</li>)}</ul></div></div>
              : <p className="review-verified"><Check size={15} />{t.noIssues}</p>}
          </section>

          <section className="panel final-review-section">
            <div className="final-review-section-heading"><FileText size={17} /><h2>{t.officerRemarks}</h2></div>
            <p className="review-observations">{application.verificationRemarks || '—'}</p>
          </section>

          <section className="panel final-review-section ai-review-section">
            <div className="final-review-section-heading"><ShieldCheck size={17} /><h2>{t.aiTitle}</h2></div>
            <p className="ai-review-notice">{t.aiNotice}</p>
            <button className="secondary-button review-no-print" disabled={aiBusy} onClick={() => void generateAiSummary()}>{aiBusy ? t.aiBusy : t.aiGenerate}</button>
            {aiError && <p className="final-review-error-text" role="alert">{aiError}</p>}
            {aiSummary && <div className="ai-review-result"><h3>{aiSummary.summary}</h3>
              {aiSummary.outstandingIssues.length > 0 && <div><strong>{t.outstanding}</strong><ul>{aiSummary.outstandingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
              <p>{aiSummary.uncertainty}</p>
            </div>}
          </section>

          <section className="panel final-review-section">
            <div className="final-review-section-heading"><Clock3 size={17} /><h2>{t.history}</h2></div>
            <p className="final-review-muted">{t.historySub}</p>
            <ol className="review-history-list">{[...application.history].reverse().map((entry) => <li key={entry.id}>
              <div><strong>{actionLabel(entry.action, language)}</strong><time>{dateLabel(entry.timestamp, language, true)}</time></div>
              <p>{entry.description || '—'}</p><small>{entry.actor} · {roleLabel(entry.actorRole, language)}</small>
            </li>)}</ol>
          </section>
        </main>

        <aside className="final-review-side review-no-print">
          <section className="panel final-review-actions">
            <h2>{isDecisionStage ? t.title : decisionLabel}</h2>
            {!canDecide && <p className="review-incomplete"><AlertCircle size={15} />{t.authorizedOnly}</p>}
            {canDecide && !isDecisionStage && application.status !== 'Approved' && application.status !== 'Rejected'
              && <p className="final-review-muted">{t.finalOnly}</p>}
            {feedback && <div className={`workflow-feedback ${feedback.type === 'error' ? 'feedback-error' : 'feedback-success'}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</div>}
            {isDecisionStage && canDecide && <>
              {(requiredIncomplete || fieldVerificationIncomplete) && <p className="review-incomplete"><AlertCircle size={15} />{t.incomplete}</p>}
              <label className="remarks-field"><span>{t.decisionRemarks}</span><textarea rows={5} maxLength={5000} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={t.remarksPlaceholder} /></label>
              <button className="primary-button" disabled={saving || !remarks.trim() || !decisionAllowed} onClick={() => void submitDecision('approve')}><Check size={15} />{t.approve}</button>
              <button className="secondary-button review-reject-button" disabled={saving || !remarks.trim() || !decisionAllowed} onClick={() => void submitDecision('reject')}><AlertCircle size={15} />{t.reject}</button>
              <label className="remarks-field"><span>{t.returnInstructions}</span><textarea rows={3} maxLength={5000} value={returnInstructions} onChange={(event) => setReturnInstructions(event.target.value)} placeholder={t.returnPlaceholder} /></label>
              <button className="secondary-button" disabled={saving || !returnInstructions.trim()} onClick={() => void submitDecision('return_for_correction')}><ArrowLeft size={15} />{t.return}</button>
            </>}
            {(application.status === 'Approved' || application.status === 'Rejected') && <button className="primary-button" onClick={() => window.print()}><Printer size={15} />{t.print}</button>}
          </section>
        </aside>
      </div>

      {finalDecision && (application.status === 'Approved' || application.status === 'Rejected') && <section className="panel decision-print-summary">
        <div className="decision-summary-brand"><span className="decision-brand-mark">ଜ</span><div><strong>JanaSeva</strong><small>ଜନସେବା · ODISHA</small></div></div>
        <h2>{t.decisionSummary}</h2><p className="decision-summary-caption">{t.administration}</p>
        <div className="decision-summary-grid">
          <Info label={t.applicationId} value={application.id} />
          <Info label={t.applicant} value={application.name} />
          <Info label={t.decision} value={decisionLabel} />
          <Info label={t.decisionDate} value={dateLabel(finalDecision.timestamp, language, true)} />
          <Info label={t.officer} value={finalDecision.actor} />
          <Info label={t.role} value={roleLabel(finalDecision.actorRole, language)} />
          <Info label={t.remarks} value={finalDecision.description} />
        </div>
        <p className="decision-summary-disclaimer">{t.notCertificate}</p>
      </section>}
      {!finalDecision && application.status !== 'Approved' && application.status !== 'Rejected' && <p className="final-review-muted no-decision-note">{t.noDecision}</p>}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="final-review-info"><span>{label}</span><strong>{value}</strong></div>
}
