import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FileText,
  MapPin,
  Search,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { aiService, type ApplicationSummary, type DocumentReview, type FieldChecklist, type FieldSummary } from './services/aiService'
import {
  applicationService,
  type ApplicationPriority,
  type ApplicationRecord,
  type DocumentCategory,
  type DocumentVerificationStatus,
  type WorkflowStatus as ApplicationStatus,
} from './services/applicationService'
import { useAuth } from './useAuth'

type Language = 'en' | 'or'

const copy = {
  en: {
    allApplications: 'All applications', applicationsSub: 'Search, review and manage income certificate applications.',
    dashboard: 'Dashboard', search: 'Search applicant name or application ID', district: 'District',
    allDistricts: 'All districts', status: 'Status', allStatuses: 'All statuses', priority: 'Priority',
    allPriorities: 'All priorities', from: 'Submitted from', to: 'Submitted to', applicant: 'Applicant',
    applicationId: 'Application ID', location: 'District / Block', submitted: 'Submitted',
    assignedOfficer: 'Assigned officer', viewDetails: 'View details', showing: 'Showing', of: 'of',
    noApplications: 'No applications found', noApplicationsSub: 'Try adjusting your search or filters.',
    loading: 'Loading applications…', previous: 'Previous page', next: 'Next page',
    applicationDetails: 'Application details', backToApplications: 'Back to applications',
    personalInformation: 'Applicant information', guardian: 'Father / guardian name', address: 'Address',
    block: 'Block', gramPanchayat: 'Gram Panchayat', annualIncome: 'Annual family income',
    mobile: 'Mobile number', applicationDate: 'Submission date', workflowStatus: 'Workflow status',
    documents: 'Document verification', documentsSub: 'Review documents against the applicable process for this application.',
    document: 'Document', uploadStatus: 'Upload', verification: 'Verification', remarks: 'Officer remarks',
    applicable: 'Applicable', notApplicable: 'Not applicable', required: 'Required', optional: 'Optional',
    uploaded: 'Uploaded', missing: 'Missing', pending: 'Pending', verified: 'Verified',
    needsCorrection: 'Needs correction', saveDocument: 'Save', saving: 'Saving…',
    uploadFile: 'Upload file', replaceFile: 'Replace file', previewFile: 'Preview', downloadFile: 'Download',
    deleteFile: 'Delete file', uploadDate: 'Uploaded', uploading: 'Uploading…', deleting: 'Deleting…',
    previewTitle: 'Document preview', closePreview: 'Close preview', confirmDelete: 'Delete this uploaded document?',
    uploadSizeLimit: 'PDF, JPG, JPEG or PNG · 5 MB per file by default', uploadComplete: 'Document uploaded.',
    replaceComplete: 'Document replaced.', deleteComplete: 'Document deleted.',
    addDocument: 'Add document and upload', newDocumentCategory: 'Document category',
    markRequired: 'Required document', addDocumentComplete: 'Document added and uploaded.',
    history: 'Application history', historySub: 'A timestamped record of actions on this application.',
    actions: 'Workflow actions', actionsSub: 'Workflow changes are saved to the connected database.',
    startVerification: 'Start document verification', completeVerification: 'Complete document verification',
    requestDocuments: 'Request missing documents', returnCorrection: 'Return for correction',
    recordResubmission: 'Record applicant resubmission', assign: 'Assign application',
    chooseOfficer: 'Choose an officer', assignButton: 'Assign officer', actionRemarks: 'Remarks or requested corrections',
    remarksPlaceholder: 'Enter the reason or documents needed…', pleaseRemark: 'Add a reason before continuing.',
    actionSuccess: 'Workflow updated.', actionError: 'The action could not be completed.',
    current: 'Current', normal: 'Normal', low: 'Low', high: 'High', urgent: 'Urgent',
    received: 'Application received', documentVerification: 'Document verification', fieldVerification: 'Field verification',
    finalDecision: 'Final decision', returned: 'Returned for correction', searchEmpty: 'No results match the selected filters.',
    errorLoading: 'Unable to load this application.', loadFailure: 'Application data could not be loaded from the server.', all: 'All', close: 'Close',
    submittedAction: 'Application submitted', assignedAction: 'Application assigned',
    verificationStarted: 'Document verification started', documentsVerified: 'Documents verified',
    returnedAction: 'Application returned', resubmittedAction: 'Application resubmitted',
    documentChecked: 'Document checked', missingRequested: 'Missing documents requested',
    documentUploadedAction: 'Document uploaded', documentReplacedAction: 'Document replaced',
    documentViewedAction: 'Document viewed', documentDeletedAction: 'Document deleted',
    documentVerifiedAction: 'Document verified', documentCorrectionAction: 'Document returned for correction',
    documentUpdatedAction: 'Document check updated',
    documentUploadDescription: 'A document file was uploaded for officer review.',
    documentReplaceDescription: 'A document file was replaced and returned to pending verification.',
    documentViewDescription: 'An officer viewed the uploaded document.',
    documentDeleteDescription: 'The uploaded file was removed; document requirements remain unchanged.',
    documentVerifyDescription: 'An officer verified the uploaded document.',
    documentCorrectionDescription: 'An officer returned the uploaded document for correction.',
    documentUpdateDescription: 'The document verification state was updated.',
    actionDescription: 'Action recorded by an officer.',
    priorityLow: 'Low', priorityNormal: 'Normal', priorityHigh: 'High', priorityUrgent: 'Urgent',
    applicationNotFound: 'Application not found', remarksRequired: 'A remark is required for this status.',
    noteConfig: 'Document requirement and applicability are shown per application; this demo does not define official requirements.',
    districtKhordha: 'Khordha', districtCuttack: 'Cuttack', districtPuri: 'Puri', districtGanjam: 'Ganjam', districtBalasore: 'Balasore',
    blockSuffix: 'block', documentIdentity: 'Identity proof', documentAddress: 'Address proof',
    documentIncome: 'Income proof', documentOther: 'Other documents',
    documentAadhaar: 'Aadhaar identification', documentRation: 'Ration card',
    documentDeclaration: 'Income declaration', documentSalary: 'Salary certificate / income proof',
    documentSupporting: 'Other supporting documents', remarksSaved: 'Document remarks saved.',
    submittedDescription: 'Income certificate application submitted online.',
    assignedDescription: 'Application assigned to the officer shown above.',
    startedDescription: 'Officer started reviewing submitted documents.',
    verifiedDescription: 'Applicable required documents were verified.',
    fieldStartedDescription: 'Field verification visit is in progress.',
    fieldCompletedDescription: 'Field observations submitted for review.',
    resubmittedDescription: 'Applicant resubmitted requested corrections for officer review.',
    districtValue: 'District',
    incompleteDocuments: 'Verify all applicable required documents before completing verification.',
    requestReasonRequired: 'Specify which documents are requested.',
    returnReasonRequired: 'Add a reason before returning the application.',
    fieldStartedAction: 'Field verification started',
    fieldCompletedAction: 'Field verification completed',
    aiDocumentsAction: 'AI document review generated', aiChecklistAction: 'AI field verification checklist generated',
    aiFieldSummaryAction: 'AI field observation summary generated', aiApplicationSummaryAction: 'AI application review summary generated',
    approvedStatus: 'Approved', rejectedStatus: 'Rejected',
    completeFieldVerification: 'Complete field verification',
    fieldObservationsRequired: 'Save the field officer observations before completing field verification.',
    saveObservations: 'Save field observations', finalReview: 'Final Review',
    approveApplication: 'Approve application', rejectApplication: 'Reject application',
    decisionHelp: 'Record a neutral final decision. A written reason is required to reject.',
    unassigned: 'Unassigned',
    aiAssistant: 'AI assistant', aiDisclaimer: 'AI-generated suggestions only. Review and correct them as needed. AI cannot decide eligibility or change workflow.',
    aiAnalyzeDocuments: 'Analyze documents', aiGenerateChecklist: 'Generate field checklist',
    aiGenerateSummary: 'Generate application summary', aiSummarizeObservations: 'Summarize observations',
    aiObservations: 'Field officer observations', aiObservationsPlaceholder: 'Enter only observations made during the field visit…',
    aiUncertainty: 'Uncertainty', aiWarning: 'Limitations', aiError: 'The AI assistant could not complete this request.',
    aiOutput: 'AI suggestions', aiNoResult: 'Choose an assistant action to generate suggestions for officer review.',
    aiBusy: 'Generating…', aiDocumentReview: 'Document review', aiFieldChecklist: 'Field verification checklist',
    aiFieldSummary: 'Field observations summary', aiApplicationSummary: 'Application review summary',
    aiAccessError: 'AI assistance is not available for your role.',
  },
  or: {
    allApplications: 'ସମସ୍ତ ଆବେଦନ', applicationsSub: 'ଆୟ ପ୍ରମାଣପତ୍ର ଆବେଦନ ଖୋଜନ୍ତୁ, ଯାଞ୍ଚ କରନ୍ତୁ ଏବଂ ପରିଚାଳନା କରନ୍ତୁ।',
    dashboard: 'ଡ୍ୟାସବୋର୍ଡ', search: 'ଆବେଦନକାରୀଙ୍କ ନାମ କିମ୍ବା ଆବେଦନ ID ଖୋଜନ୍ତୁ', district: 'ଜିଲ୍ଲା',
    allDistricts: 'ସମସ୍ତ ଜିଲ୍ଲା', status: 'ସ୍ଥିତି', allStatuses: 'ସମସ୍ତ ସ୍ଥିତି', priority: 'ଅଗ୍ରାଧିକାର',
    allPriorities: 'ସମସ୍ତ ଅଗ୍ରାଧିକାର', from: 'ଏହି ତାରିଖଠାରୁ', to: 'ଏହି ତାରିଖ ପର୍ଯ୍ୟନ୍ତ', applicant: 'ଆବେଦନକାରୀ',
    applicationId: 'ଆବେଦନ ID', location: 'ଜିଲ୍ଲା / ବ୍ଲକ', submitted: 'ଦାଖଲ ତାରିଖ',
    assignedOfficer: 'ନିଯୁକ୍ତ ଅଧିକାରୀ', viewDetails: 'ବିବରଣୀ ଦେଖନ୍ତୁ', showing: 'ଦେଖାଯାଉଛି', of: 'ମଧ୍ୟରୁ',
    noApplications: 'କୌଣସି ଆବେଦନ ମିଳିଲା ନାହିଁ', noApplicationsSub: 'ଖୋଜ କିମ୍ବା ଫିଲ୍ଟର ବଦଳାଇ ଦେଖନ୍ତୁ।',
    loading: 'ଆବେଦନ ଲୋଡ୍ ହେଉଛି…', previous: 'ପୂର୍ବ ପୃଷ୍ଠା', next: 'ପରବର୍ତ୍ତୀ ପୃଷ୍ଠା',
    applicationDetails: 'ଆବେଦନ ବିବରଣୀ', backToApplications: 'ଆବେଦନ ତାଲିକାକୁ ଫେରନ୍ତୁ',
    personalInformation: 'ଆବେଦନକାରୀଙ୍କ ସୂଚନା', guardian: 'ପିତା / ଅଭିଭାବକଙ୍କ ନାମ', address: 'ଠିକଣା',
    block: 'ବ୍ଲକ', gramPanchayat: 'ଗ୍ରାମ ପଞ୍ଚାୟତ', annualIncome: 'ବାର୍ଷିକ ପରିବାର ଆୟ',
    mobile: 'ମୋବାଇଲ୍ ନମ୍ବର', applicationDate: 'ଦାଖଲ ତାରିଖ', workflowStatus: 'କାର୍ଯ୍ୟଧାରାର ସ୍ଥିତି',
    documents: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ', documentsSub: 'ଏହି ଆବେଦନ ପାଇଁ ପ୍ରଯୁଜ୍ୟ ପ୍ରକ୍ରିୟା ଅନୁଯାୟୀ ଦସ୍ତାବିଜ ଯାଞ୍ଚ କରନ୍ତୁ।',
    document: 'ଦସ୍ତାବିଜ', uploadStatus: 'ଅପଲୋଡ୍', verification: 'ଯାଞ୍ଚ ସ୍ଥିତି', remarks: 'ଅଧିକାରୀଙ୍କ ମତାମତ',
    applicable: 'ପ୍ରଯୁଜ୍ୟ', notApplicable: 'ପ୍ରଯୁଜ୍ୟ ନୁହେଁ', required: 'ଆବଶ୍ୟକ', optional: 'ଇଚ୍ଛାଧୀନ',
    uploaded: 'ଅପଲୋଡ୍ ହୋଇଛି', missing: 'ଅନୁପସ୍ଥିତ', pending: 'ଅପେକ୍ଷାରେ', verified: 'ଯାଞ୍ଚ ହୋଇଛି',
    needsCorrection: 'ସଂଶୋଧନ ଆବଶ୍ୟକ', saveDocument: 'ସଂରକ୍ଷଣ କରନ୍ତୁ', saving: 'ସଂରକ୍ଷଣ ହେଉଛି…',
    uploadFile: 'ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ', replaceFile: 'ଫାଇଲ୍ ବଦଳାନ୍ତୁ', previewFile: 'ପୂର୍ବଦର୍ଶନ',
    downloadFile: 'ଡାଉନଲୋଡ୍', deleteFile: 'ଫାଇଲ୍ ହଟାନ୍ତୁ', uploadDate: 'ଅପଲୋଡ୍ ତାରିଖ',
    uploading: 'ଅପଲୋଡ୍ ହେଉଛି…', deleting: 'ହଟାଯାଉଛି…', previewTitle: 'ଦସ୍ତାବିଜ ପୂର୍ବଦର୍ଶନ',
    closePreview: 'ପୂର୍ବଦର୍ଶନ ବନ୍ଦ କରନ୍ତୁ', confirmDelete: 'ଏହି ଅପଲୋଡ୍ ହୋଇଥିବା ଦସ୍ତାବିଜ ହଟାଇବେ କି?',
    uploadSizeLimit: 'PDF, JPG, JPEG କିମ୍ବା PNG · ପ୍ରତି ଫାଇଲ୍ ପାଇଁ ଡିଫଲ୍ଟ ୫ MB',
    uploadComplete: 'ଦସ୍ତାବିଜ ଅପଲୋଡ୍ ହୋଇଛି।', replaceComplete: 'ଦସ୍ତାବିଜ ବଦଳାଯାଇଛି।',
    deleteComplete: 'ଦସ୍ତାବିଜ ହଟାଯାଇଛି।',
    addDocument: 'ଦସ୍ତାବିଜ ଯୋଡ଼ି ଅପଲୋଡ୍ କରନ୍ତୁ', newDocumentCategory: 'ଦସ୍ତାବିଜ ବର୍ଗ',
    markRequired: 'ଆବଶ୍ୟକ ଦସ୍ତାବିଜ', addDocumentComplete: 'ଦସ୍ତାବିଜ ଯୋଡ଼ାଯାଇ ଅପଲୋଡ୍ ହୋଇଛି।',
    history: 'ଆବେଦନ ଇତିହାସ', historySub: 'ଏହି ଆବେଦନରେ ହୋଇଥିବା କାର୍ଯ୍ୟର ତାରିଖ ଓ ସମୟ ସହ ରେକର୍ଡ।',
    actions: 'କାର୍ଯ୍ୟଧାରା କାର୍ଯ୍ୟ', actionsSub: 'କାର୍ଯ୍ୟଧାରାର ପରିବର୍ତ୍ତନଗୁଡ଼ିକ ସଂଯୁକ୍ତ ତଥ୍ୟଭଣ୍ଡାରରେ ସଂରକ୍ଷିତ ହୁଏ।',
    startVerification: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ଆରମ୍ଭ କରନ୍ତୁ', completeVerification: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ସମାପ୍ତ କରନ୍ତୁ',
    requestDocuments: 'ଅନୁପସ୍ଥିତ ଦସ୍ତାବିଜ ମାଗନ୍ତୁ', returnCorrection: 'ସଂଶୋଧନ ପାଇଁ ଫେରାନ୍ତୁ',
    recordResubmission: 'ଆବେଦନ ପୁନଃଦାଖଲ ରେକର୍ଡ କରନ୍ତୁ', assign: 'ଆବେଦନ ନିଯୁକ୍ତ କରନ୍ତୁ',
    chooseOfficer: 'ଅଧିକାରୀ ବାଛନ୍ତୁ', assignButton: 'ଅଧିକାରୀ ନିଯୁକ୍ତ କରନ୍ତୁ', actionRemarks: 'ମତାମତ କିମ୍ବା ଆବଶ୍ୟକ ସଂଶୋଧନ',
    remarksPlaceholder: 'କାରଣ କିମ୍ବା ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ଲେଖନ୍ତୁ…', pleaseRemark: 'ଆଗକୁ ବଢ଼ିବା ପୂର୍ବରୁ କାରଣ ଲେଖନ୍ତୁ।',
    actionSuccess: 'କାର୍ଯ୍ୟଧାରା ଅପଡେଟ୍ ହୋଇଛି।', actionError: 'ଏହି କାର୍ଯ୍ୟ ସମାପ୍ତ ହୋଇପାରିଲା ନାହିଁ।',
    current: 'ବର୍ତ୍ତମାନ', normal: 'ସାଧାରଣ', low: 'କମ୍', high: 'ଅଧିକ', urgent: 'ଜରୁରୀ',
    received: 'ଆବେଦନ ଗ୍ରହଣ ହୋଇଛି', documentVerification: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ', fieldVerification: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ',
    finalDecision: 'ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି', returned: 'ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି', searchEmpty: 'ଏହି ଫିଲ୍ଟର ସହ କୌଣସି ଫଳାଫଳ ମେଳ ଖାଉନାହିଁ।',
    errorLoading: 'ଏହି ଆବେଦନ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।', loadFailure: 'ସର୍ଭରରୁ ଆବେଦନ ତଥ୍ୟ ଆଣିହେଲା ନାହିଁ।', all: 'ସମସ୍ତ', close: 'ବନ୍ଦ କରନ୍ତୁ',
    submittedAction: 'ଆବେଦନ ଦାଖଲ ହୋଇଛି', assignedAction: 'ଆବେଦନ ନିଯୁକ୍ତ ହୋଇଛି',
    verificationStarted: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ଆରମ୍ଭ ହୋଇଛି', documentsVerified: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ହୋଇଛି',
    returnedAction: 'ଆବେଦନ ଫେରାଯାଇଛି', resubmittedAction: 'ଆବେଦନ ପୁନଃଦାଖଲ ହୋଇଛି',
    documentChecked: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ହୋଇଛି', missingRequested: 'ଅନୁପସ୍ଥିତ ଦସ୍ତାବିଜ ମଗାଯାଇଛି',
    documentUploadedAction: 'ଦସ୍ତାବିଜ ଅପଲୋଡ୍ ହୋଇଛି', documentReplacedAction: 'ଦସ୍ତାବିଜ ବଦଳାଯାଇଛି',
    documentViewedAction: 'ଦସ୍ତାବିଜ ଦେଖାଯାଇଛି', documentDeletedAction: 'ଦସ୍ତାବିଜ ହଟାଯାଇଛି',
    documentVerifiedAction: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ହୋଇଛି', documentCorrectionAction: 'ଦସ୍ତାବିଜ ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି',
    documentUpdatedAction: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ସ୍ଥିତି ଅପଡେଟ୍ ହୋଇଛି',
    documentUploadDescription: 'ଅଧିକାରୀଙ୍କ ଯାଞ୍ଚ ପାଇଁ ଦସ୍ତାବିଜ ଅପଲୋଡ୍ ହୋଇଛି।',
    documentReplaceDescription: 'ଦସ୍ତାବିଜ ବଦଳାଯାଇଛି ଏବଂ ପୁନଃ ଯାଞ୍ଚ ପାଇଁ ଅପେକ୍ଷାରେ ଅଛି।',
    documentViewDescription: 'ଅଧିକାରୀ ଅପଲୋଡ୍ ହୋଇଥିବା ଦସ୍ତାବିଜ ଦେଖିଛନ୍ତି।',
    documentDeleteDescription: 'ଅପଲୋଡ୍ ଫାଇଲ୍ ହଟାଯାଇଛି; ଦସ୍ତାବିଜ ଆବଶ୍ୟକତା ଅପରିବର୍ତ୍ତିତ ଅଛି।',
    documentVerifyDescription: 'ଅଧିକାରୀ ଅପଲୋଡ୍ ହୋଇଥିବା ଦସ୍ତାବିଜ ଯାଞ୍ଚ କରିଛନ୍ତି।',
    documentCorrectionDescription: 'ଅଧିକାରୀ ଦସ୍ତାବିଜକୁ ସଂଶୋଧନ ପାଇଁ ଫେରାଇଛନ୍ତି।',
    documentUpdateDescription: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ସ୍ଥିତି ଅପଡେଟ୍ ହୋଇଛି।',
    actionDescription: 'ଅଧିକାରୀଙ୍କ ଦ୍ୱାରା କାର୍ଯ୍ୟ ରେକର୍ଡ ହୋଇଛି।',
    priorityLow: 'କମ୍', priorityNormal: 'ସାଧାରଣ', priorityHigh: 'ଅଧିକ', priorityUrgent: 'ଜରୁରୀ',
    applicationNotFound: 'ଆବେଦନ ମିଳିଲା ନାହିଁ', remarksRequired: 'ଏହି ସ୍ଥିତି ପାଇଁ ମତାମତ ଆବଶ୍ୟକ।',
    noteConfig: 'ଦସ୍ତାବିଜର ଆବଶ୍ୟକତା ଓ ପ୍ରଯୁଜ୍ୟତା ପ୍ରତ୍ୟେକ ଆବେଦନ ଅନୁଯାୟୀ ଦିଆଯାଇଛି; ଏହି ଡେମୋ ଅଧିକାରିକ ନିୟମ ନିର୍ଦ୍ଧାରଣ କରେନାହିଁ।',
    districtKhordha: 'ଖୋର୍ଦ୍ଧା', districtCuttack: 'କଟକ', districtPuri: 'ପୁରୀ', districtGanjam: 'ଗଞ୍ଜାମ', districtBalasore: 'ବାଲେଶ୍ୱର',
    blockSuffix: 'ବ୍ଲକ', documentIdentity: 'ପରିଚୟ ପ୍ରମାଣ', documentAddress: 'ଠିକଣା ପ୍ରମାଣ',
    documentIncome: 'ଆୟ ପ୍ରମାଣ', documentOther: 'ଅନ୍ୟାନ୍ୟ ଦସ୍ତାବିଜ',
    documentAadhaar: 'ଆଧାର ପରିଚୟ ପତ୍ର', documentRation: 'ରାସନ କାର୍ଡ',
    documentDeclaration: 'ଆୟ ଘୋଷଣାପତ୍ର', documentSalary: 'ଦରମା ପ୍ରମାଣପତ୍ର / ଆୟ ପ୍ରମାଣ',
    documentSupporting: 'ଅନ୍ୟାନ୍ୟ ସହାୟକ ଦସ୍ତାବିଜ', remarksSaved: 'ଦସ୍ତାବିଜ ଉପରେ ମତାମତ ସଂରକ୍ଷିତ ହୋଇଛି।',
    submittedDescription: 'ଆୟ ପ୍ରମାଣପତ୍ର ଆବେଦନ ଅନଲାଇନ୍‌ରେ ଦାଖଲ ହୋଇଛି।',
    assignedDescription: 'ଉପରେ ଦର୍ଶାଯାଇଥିବା ଅଧିକାରୀଙ୍କୁ ଆବେଦନ ନିଯୁକ୍ତ ହୋଇଛି।',
    startedDescription: 'ଅଧିକାରୀ ଦାଖଲ ହୋଇଥିବା ଦସ୍ତାବିଜର ଯାଞ୍ଚ ଆରମ୍ଭ କରିଛନ୍ତି।',
    verifiedDescription: 'ପ୍ରଯୁଜ୍ୟ ଆବଶ୍ୟକ ଦସ୍ତାବିଜଗୁଡ଼ିକ ଯାଞ୍ଚ ହୋଇଛି।',
    fieldStartedDescription: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ପରିଦର୍ଶନ ଚାଲିଛି।',
    fieldCompletedDescription: 'କ୍ଷେତ୍ର ଯାଞ୍ଚର ନିରୀକ୍ଷଣ ସମୀକ୍ଷା ପାଇଁ ଦାଖଲ ହୋଇଛି।',
    resubmittedDescription: 'ଆବେଦନକାରୀ ସଂଶୋଧନଗୁଡ଼ିକ ପୁନଃଦାଖଲ କରିଛନ୍ତି।',
    districtValue: 'ଜିଲ୍ଲା',
    incompleteDocuments: 'ଯାଞ୍ଚ ସମାପ୍ତ କରିବା ପୂର୍ବରୁ ସମସ୍ତ ପ୍ରଯୁଜ୍ୟ ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ଯାଞ୍ଚ କରନ୍ତୁ।',
    requestReasonRequired: 'କେଉଁ ଦସ୍ତାବିଜ ଆବଶ୍ୟକ ତାହା ଉଲ୍ଲେଖ କରନ୍ତୁ।',
    returnReasonRequired: 'ଆବେଦନ ଫେରାଇବା ପୂର୍ବରୁ କାରଣ ଲେଖନ୍ତୁ।',
    fieldStartedAction: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ଆରମ୍ଭ ହୋଇଛି',
    fieldCompletedAction: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ସମାପ୍ତ ହୋଇଛି',
    aiDocumentsAction: 'AI ଦସ୍ତାବିଜ ଯାଞ୍ଚ ସୃଷ୍ଟି ହୋଇଛି', aiChecklistAction: 'AI କ୍ଷେତ୍ର ଯାଞ୍ଚ ତାଲିକା ସୃଷ୍ଟି ହୋଇଛି',
    aiFieldSummaryAction: 'AI କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ସାରାଂଶ ସୃଷ୍ଟି ହୋଇଛି', aiApplicationSummaryAction: 'AI ଆବେଦନ ସମୀକ୍ଷା ସାରାଂଶ ସୃଷ୍ଟି ହୋଇଛି',
    approvedStatus: 'ଅନୁମୋଦିତ', rejectedStatus: 'ନାକଚ',
    completeFieldVerification: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ସମାପ୍ତ କରନ୍ତୁ',
    fieldObservationsRequired: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ସମାପ୍ତ କରିବା ପୂର୍ବରୁ କ୍ଷେତ୍ର ଅଧିକାରୀଙ୍କ ପର୍ଯ୍ୟବେକ୍ଷଣ ସଂରକ୍ଷଣ କରନ୍ତୁ।',
    saveObservations: 'କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ସଂରକ୍ଷଣ କରନ୍ତୁ', finalReview: 'ଚୂଡ଼ାନ୍ତ ସମୀକ୍ଷା',
    approveApplication: 'ଆବେଦନ ଅନୁମୋଦନ କରନ୍ତୁ', rejectApplication: 'ଆବେଦନ ନାକଚ କରନ୍ତୁ',
    decisionHelp: 'ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ରେକର୍ଡ କରନ୍ତୁ। ନାକଚ କରିବା ପାଇଁ ଲିଖିତ କାରଣ ଆବଶ୍ୟକ।',
    unassigned: 'ନିଯୁକ୍ତ ହୋଇନାହାନ୍ତି',
    aiAssistant: 'AI ସହାୟକ', aiDisclaimer: 'କେବଳ AI-ସୃଷ୍ଟ ପରାମର୍ଶ। ଆବଶ୍ୟକ ହେଲେ ଯାଞ୍ଚ ଓ ସଂଶୋଧନ କରନ୍ତୁ। AI ଯୋଗ୍ୟତା ନିର୍ଣ୍ଣୟ କିମ୍ବା କାର୍ଯ୍ୟଧାରା ପରିବର୍ତ୍ତନ କରିପାରିବ ନାହିଁ।',
    aiAnalyzeDocuments: 'ଦସ୍ତାବିଜ ବିଶ୍ଳେଷଣ', aiGenerateChecklist: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ତାଲିକା ସୃଷ୍ଟି',
    aiGenerateSummary: 'ଆବେଦନ ସାରାଂଶ ସୃଷ୍ଟି', aiSummarizeObservations: 'ପର୍ଯ୍ୟବେକ୍ଷଣର ସାରାଂଶ',
    aiObservations: 'କ୍ଷେତ୍ର ଅଧିକାରୀଙ୍କ ପର୍ଯ୍ୟବେକ୍ଷଣ', aiObservationsPlaceholder: 'କ୍ଷେତ୍ର ପରିଦର୍ଶନରେ କରାଯାଇଥିବା ପର୍ଯ୍ୟବେକ୍ଷଣ ମାତ୍ର ଲେଖନ୍ତୁ…',
    aiUncertainty: 'ଅନିଶ୍ଚିତତା', aiWarning: 'ସୀମାବଦ୍ଧତା', aiError: 'AI ସହାୟକ ଏହି ଅନୁରୋଧ ସମାପ୍ତ କରିପାରିଲା ନାହିଁ।',
    aiOutput: 'AI ପରାମର୍ଶ', aiNoResult: 'ଅଧିକାରୀଙ୍କ ଯାଞ୍ଚ ପାଇଁ ପରାମର୍ଶ ସୃଷ୍ଟି କରିବାକୁ ଏକ ସହାୟକ କାର୍ଯ୍ୟ ବାଛନ୍ତୁ।',
    aiBusy: 'ସୃଷ୍ଟି ହେଉଛି…', aiDocumentReview: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ', aiFieldChecklist: 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ତାଲିକା',
    aiFieldSummary: 'କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ସାରାଂଶ', aiApplicationSummary: 'ଆବେଦନ ସମୀକ୍ଷା ସାରାଂଶ',
    aiAccessError: 'ଆପଣଙ୍କ ଭୂମିକା ପାଇଁ AI ସହାୟତା ଉପଲବ୍ଧ ନାହିଁ।',
  },
} satisfies Record<Language, Record<string, string>>

const statusLabels: Record<ApplicationStatus, keyof typeof copy.en> = {
  'Application received': 'received',
  'Document verification': 'documentVerification',
  'Field verification': 'fieldVerification',
  'Final decision': 'finalDecision',
  'Returned for correction': 'returned',
  Approved: 'approvedStatus',
  Rejected: 'rejectedStatus',
}

const statusOptions: ApplicationStatus[] = [
  'Application received',
  'Document verification',
  'Field verification',
  'Final decision',
  'Returned for correction',
  'Approved',
  'Rejected',
]
const priorities: ApplicationPriority[] = ['Urgent', 'High', 'Normal', 'Low']
function isWorkflowStatus(value: string): value is ApplicationStatus {
  return statusOptions.some((status) => status === value)
}

function isApplicationPriority(value: string): value is ApplicationPriority {
  return priorities.some((priority) => priority === value)
}

function isDocumentVerificationStatus(value: string): value is DocumentVerificationStatus {
  return value === 'Pending' || value === 'Verified' || value === 'Needs correction'
}

function isDocumentCategory(value: string): value is DocumentCategory {
  return value === 'identity' || value === 'address' || value === 'income'
    || value === 'ration' || value === 'supporting' || value === 'other'
}

function districtLabel(district: string, language: Language) {
  const districtKeys: Record<string, keyof typeof copy.en> = {
    Khordha: 'districtKhordha',
    Cuttack: 'districtCuttack',
    Puri: 'districtPuri',
    Ganjam: 'districtGanjam',
    Balasore: 'districtBalasore',
  }
  const key = districtKeys[district]
  return key ? copy[language][key] : district
}

function documentLabel(id: string, name: string, language: Language) {
  const documentKeys: Record<string, keyof typeof copy.en> = {
    identity: 'documentIdentity',
    address: 'documentAddress',
    income: 'documentIncome',
    other: 'documentOther',
    aadhaar: 'documentAadhaar',
    ration: 'documentRation',
    declaration: 'documentDeclaration',
    salary: 'documentSalary',
    supporting: 'documentSupporting',
  }
  const base = copy[language][documentKeys[id] ?? 'documentSupporting']
  const maskedNumber = name.match(/\(XXXX XXXX XXXX\)/)?.[0]
  return `${base}${maskedNumber ? ` ${maskedNumber}` : ''}`
}

function historyDescription(entry: ApplicationRecord['history'][number], language: Language) {
  const descriptions: Record<string, keyof typeof copy.en> = {
    'Application submitted': 'submittedDescription',
    'Application assigned': 'assignedDescription',
    'Document verification started': 'startedDescription',
    'Documents verified': 'verifiedDescription',
    'Field verification started': 'fieldStartedDescription',
    'Field verification completed': 'fieldCompletedDescription',
    'Application resubmitted': 'resubmittedDescription',
    'AI document review generated': 'aiDocumentsAction',
    'AI field verification checklist generated': 'aiChecklistAction',
    'AI field observation summary generated': 'aiFieldSummaryAction',
    'AI application review summary generated': 'aiApplicationSummaryAction',
    'Document uploaded': 'documentUploadDescription',
    'Document replaced': 'documentReplaceDescription',
    'Document viewed': 'documentViewDescription',
    'Document deleted': 'documentDeleteDescription',
    'Document verified': 'documentVerifyDescription',
    'Document returned for correction': 'documentCorrectionDescription',
    'Document check updated': 'documentUpdateDescription',
  }
  const key = descriptions[entry.action]
  if (key) return copy[language][key]
  return entry.description
}

function formatDate(value: string, language: Language, includeTime = false) {
  return new Intl.DateTimeFormat(language === 'or' ? 'or-IN' : 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function statusLabel(status: ApplicationStatus, language: Language) {
  return copy[language][statusLabels[status]]
}

function priorityLabel(priority: ApplicationPriority, language: Language) {
  return copy[language][`priority${priority}` as keyof typeof copy.en]
}

export function ApplicationsPage({ language }: { language: Language }) {
  const t = copy[language]
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState('')
  const [status, setStatus] = useState<ApplicationStatus | ''>('')
  const [priority, setPriority] = useState<ApplicationPriority | ''>('')
  const [submittedFrom, setSubmittedFrom] = useState('')
  const [submittedTo, setSubmittedTo] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<ApplicationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pageSize = 4
  const filters = useMemo(() => ({ query, district, status, priority, submittedFrom, submittedTo }), [query, district, status, priority, submittedFrom, submittedTo])

  useEffect(() => {
    let active = true
    applicationService.list(filters, page, pageSize).then((result) => {
      if (active) {
        setResults(result.items)
        setTotal(result.total)
        setPages(result.pages)
        setError('')
      }
    }).catch(() => {
      if (active) {
        setError(t.errorLoading)
        setResults([])
        setTotal(0)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [filters, page, pageSize, t.errorLoading])

  const pageCount = Math.max(1, pages)
  const pageRows = results
  const districts = ['Balasore', 'Cuttack', 'Ganjam', 'Khordha', 'Puri']

  return (
    <div className="content management-content">
      <div className="management-title-row">
        <div><div className="management-breadcrumb"><Link to="/">{t.dashboard}</Link><ChevronRight size={13} /><span>{t.allApplications}</span></div><h1>{t.allApplications}</h1><p>{t.applicationsSub}</p></div>
        <span className="memory-note"><i /> {t.actionsSub}</span>
      </div>
      <section className="panel applications-list-panel">
        <div className="application-filters">
          <label className="management-search"><Search size={16} /><input value={query} onChange={(event) => { setLoading(true); setPage(1); setQuery(event.target.value) }} placeholder={t.search} aria-label={t.search} /></label>
          <label className="management-select"><span className="sr-only">{t.district}</span><select value={district} onChange={(event) => { setLoading(true); setPage(1); setDistrict(event.target.value) }}><option value="">{t.allDistricts}</option>{districts.map((item) => <option key={item} value={item}>{districtLabel(item, language)}</option>)}</select><ChevronDown size={14} /></label>
          <label className="management-select"><span className="sr-only">{t.status}</span><select value={status} onChange={(event) => { setLoading(true); setPage(1); setStatus(isWorkflowStatus(event.target.value) ? event.target.value : '') }}><option value="">{t.allStatuses}</option>{statusOptions.map((item) => <option key={item} value={item}>{statusLabel(item, language)}</option>)}</select><ChevronDown size={14} /></label>
          <label className="management-select"><span className="sr-only">{t.priority}</span><select value={priority} onChange={(event) => { setLoading(true); setPage(1); setPriority(isApplicationPriority(event.target.value) ? event.target.value : '') }}><option value="">{t.allPriorities}</option>{priorities.map((item) => <option key={item} value={item}>{priorityLabel(item, language)}</option>)}</select><ChevronDown size={14} /></label>
          <label className="date-filter"><span>{t.from}</span><input type="date" value={submittedFrom} max={submittedTo || undefined} onChange={(event) => { setLoading(true); setPage(1); setSubmittedFrom(event.target.value) }} /></label>
          <label className="date-filter"><span>{t.to}</span><input type="date" value={submittedTo} min={submittedFrom || undefined} onChange={(event) => { setLoading(true); setPage(1); setSubmittedTo(event.target.value) }} /></label>
        </div>
        <div className="management-table-scroll">
          <table className="applications-table">
            <thead><tr><th>{t.applicant}</th><th>{t.applicationId}</th><th>{t.location}</th><th>{t.submitted}</th><th>{t.assignedOfficer}</th><th>{t.status}</th><th>{t.priority}</th><th /></tr></thead>
            <tbody>
              {loading ? <tr><td className="management-empty" colSpan={8}><span className="loading-spinner" />{t.loading}</td></tr>
                : error ? <tr><td className="management-empty error-empty" colSpan={8}><AlertCircle size={20} />{error}</td></tr>
                  : pageRows.map((application) => (
                    <tr key={application.id}>
                      <td><div className="management-applicant"><span className={`avatar avatar-${application.color}`}>{application.initials}</span><strong>{application.name}</strong></div></td>
                      <td><span className="application-id">{application.id}</span></td>
                      <td><span className="location-value">{districtLabel(application.district, language)}<small>{application.block} {t.blockSuffix}</small></span></td>
                      <td>{formatDate(application.submittedAt, language)}</td>
                      <td>{application.assignedOfficer}</td>
                      <td><span className={`management-status status-${application.status.toLowerCase().replaceAll(' ', '-')}`}>{statusLabel(application.status, language)}</span></td>
                      <td><span className={`priority-label priority-${application.priority.toLowerCase()}`}><i />{priorityLabel(application.priority, language)}</span></td>
                      <td><button className="details-button" onClick={() => navigate(`/applications/${application.id}`)}>{t.viewDetails}<ArrowRight size={14} /></button></td>
                    </tr>
                  ))}
              {!loading && !error && results.length === 0 && <tr><td colSpan={8}><div className="management-empty empty-state"><span className="empty-search-icon"><Search size={21} /></span><strong>{t.noApplications}</strong><p>{t.noApplicationsSub}</p></div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="management-pagination">
          <span>{t.showing} <strong>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min((page - 1) * pageSize + results.length, total)}</strong> {t.of} <strong>{total}</strong></span>
          <div><button aria-label={t.previous} disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => Math.max(1, value - 1)) }}><ChevronLeft size={16} /></button><span>{page} / {pageCount}</span><button aria-label={t.next} disabled={page >= pageCount} onClick={() => { setLoading(true); setPage((value) => Math.min(pageCount, value + 1)) }}><ChevronRight size={16} /></button></div>
        </div>
      </section>
    </div>
  )
}

export function ApplicationDetailsPage({ language }: { language: Language }) {
  const t = copy[language]
  const { applicationId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const location = useLocation()
  const applications = useSyncExternalStore(applicationService.subscribe, applicationService.getSnapshot, applicationService.getSnapshot)
  const application = applications.find((item) => item.id === applicationId)
  const [loadState, setLoadState] = useState<{ applicationId: string; status: 'loading' | 'loaded' | 'error' }>({
    applicationId,
    status: 'loading',
  })
  const loading = loadState.applicationId !== applicationId || loadState.status === 'loading'
  const loadError = loadState.applicationId === applicationId && loadState.status === 'error'
  const [remarks, setRemarks] = useState('')
  const [officer, setOfficer] = useState('')
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [savingDocument, setSavingDocument] = useState('')
  const [documentRemarks, setDocumentRemarks] = useState<Record<string, string>>({})
  const [uploadingDocument, setUploadingDocument] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [newDocumentType, setNewDocumentType] = useState<DocumentCategory>('identity')
  const [newDocumentApplicable, setNewDocumentApplicable] = useState(true)
  const [newDocumentRequired, setNewDocumentRequired] = useState(false)
  const [documentAction, setDocumentAction] = useState('')
  const [documentFeedback, setDocumentFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [preview, setPreview] = useState<{ url: string; mimeType: string; name: string } | null>(null)
  const [fieldObservations, setFieldObservations] = useState('')
  const [savingObservations, setSavingObservations] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiResult, setAiResult] = useState<{ title: string; data: DocumentReview | FieldChecklist | FieldSummary | ApplicationSummary } | null>(null)

  useEffect(() => {
    let active = true
    applicationService.getById(applicationId).then(() => {
      if (active) {
        setLoadState({ applicationId, status: 'loaded' })
        setFeedback(null)
        const record = applicationService.getSnapshot().find((item) => item.id === applicationId)
        setDocumentRemarks(Object.fromEntries(record?.documents.map((document) => [document.id, document.remarks]) ?? []))
        setFieldObservations(record?.fieldObservations ?? '')
      }
    }).catch(() => {
      if (active) {
        setLoadState({ applicationId, status: 'error' })
      }
    })
    return () => { active = false }
  }, [applicationId])

  useEffect(() => {
    if (!user || user.role === 'FIELD_OFFICER') return
    let active = true
    applicationService.listOfficers().then((items) => {
      if (active) setOfficers(items.map(({ id, name }) => ({ id, name })))
    }).catch((error: unknown) => {
      if (active) setFeedback({ type: 'error', message: error instanceof Error ? error.message : t.actionError })
    })
    return () => { active = false }
  }, [user, t.actionError])

  useEffect(() => {
    if (!loading && location.hash === '#history') {
      document.getElementById('application-history')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading, location.hash])

  const perform = async (action: () => Promise<ApplicationRecord>, clearRemarks = false) => {
    setFeedback(null)
    try {
      await action()
      setFeedback({ type: 'success', message: t.actionSuccess })
      if (clearRemarks) setRemarks('')
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : ''
        const message = errorMessage.includes('Verify all applicable required documents before')
          ? t.incompleteDocuments
          : errorMessage.includes('Specify which documents are requested.')
            ? t.requestReasonRequired
            : errorMessage.includes('Add a reason before returning the application.')
              ? t.returnReasonRequired
              : t.actionError
      setFeedback({ type: 'error', message })
    }
  }

  const updateDocument = async (documentId: string, value: DocumentVerificationStatus, remark: string) => {
    const document = application?.documents.find((item) => item.id === documentId)
    if (!document || !application) return
    setSavingDocument(documentId)
    await perform(() => applicationService.updateDocument(application.id, documentId, value, remark))
    setSavingDocument('')
  }

  const saveFieldObservations = async () => {
    setSavingObservations(true)
    await perform(() => applicationService.saveFieldObservations(applicationId, fieldObservations))
    setSavingObservations(false)
  }

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const uploadDocument = async (documentId: string, file: File) => {
    setDocumentFeedback(null)
    setUploadingDocument(documentId)
    setUploadProgress(0)
    try {
      const existing = application?.documents.find((item) => item.id === documentId)?.uploadStatus === 'Uploaded'
      await applicationService.uploadDocument(applicationId, documentId, file, setUploadProgress)
      setDocumentFeedback({ type: 'success', message: existing ? t.replaceComplete : t.uploadComplete })
    } catch (error) {
      setDocumentFeedback({ type: 'error', message: error instanceof Error ? error.message : t.actionError })
    } finally {
      setUploadingDocument('')
    }
  }

  const addDocumentWithFile = async (file: File) => {
    setDocumentFeedback(null)
    setUploadingDocument('new')
    setUploadProgress(0)
    try {
      await applicationService.addDocumentWithFile(applicationId, file, {
        documentType: newDocumentType,
        applicable: newDocumentApplicable,
        required: newDocumentApplicable && newDocumentRequired,
      }, setUploadProgress)
      setDocumentFeedback({ type: 'success', message: t.addDocumentComplete })
    } catch (error) {
      setDocumentFeedback({ type: 'error', message: error instanceof Error ? error.message : t.actionError })
    } finally {
      setUploadingDocument('')
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!window.confirm(t.confirmDelete)) return
    setDocumentFeedback(null)
    setDocumentAction(documentId)
    try {
      await applicationService.deleteDocument(applicationId, documentId)
      setDocumentFeedback({ type: 'success', message: t.deleteComplete })
    } catch (error) {
      setDocumentFeedback({ type: 'error', message: error instanceof Error ? error.message : t.actionError })
    } finally {
      setDocumentAction('')
    }
  }

  const downloadDocument = async (documentId: string, filename: string) => {
    setDocumentFeedback(null)
    setDocumentAction(documentId)
    try {
      const blob = await applicationService.getDocumentFile(documentId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setDocumentFeedback({ type: 'error', message: error instanceof Error ? error.message : t.actionError })
    } finally {
      setDocumentAction('')
    }
  }

  const previewDocument = async (documentId: string, filename: string, mimeType: string) => {
    setDocumentFeedback(null)
    setDocumentAction(documentId)
    try {
      const blob = await applicationService.getDocumentFile(documentId, true)
      setPreview({ url: URL.createObjectURL(blob), mimeType, name: filename })
    } catch (error) {
      setDocumentFeedback({ type: 'error', message: error instanceof Error ? error.message : t.actionError })
    } finally {
      setDocumentAction('')
    }
  }

  const requestAi = async (
    title: string,
    action: () => Promise<DocumentReview | FieldChecklist | FieldSummary | ApplicationSummary>,
  ) => {
    setAiBusy(true)
    setAiError('')
    setAiResult(null)
    try {
      const data = await action()
      setAiResult({ title, data })
      await applicationService.getById(applicationId)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setAiError(message.includes('not available for your role') ? t.aiAccessError : (message || t.aiError))
    } finally {
      setAiBusy(false)
    }
  }

  if (loading) return <div className="content management-content"><div className="panel detail-loading"><span className="loading-spinner" />{t.loading}</div></div>
  if (loadError || !application) return <div className="content management-content"><div className="panel missing-application"><AlertCircle size={22} /><strong>{loadError ? t.loadFailure : t.applicationNotFound}</strong><button className="secondary-button" onClick={() => navigate('/applications')}><ArrowLeft size={15} />{t.backToApplications}</button></div></div>

  const requiredIncomplete = application.documents.some((document) => document.applicable && document.required && (document.uploadStatus !== 'Uploaded' || document.verificationStatus !== 'Verified'))
  const canReviewDocuments = user?.role === 'ADMIN' || user?.role === 'REVENUE_OFFICER'
  const canEditFieldObservations = user?.role === 'FIELD_OFFICER' && application.status === 'Field verification'
  const documentsEditable = canReviewDocuments && application.status !== 'Approved' && application.status !== 'Rejected'
  const descriptionLabels: Record<string, string> = {
    'Application submitted': t.submittedAction,
    'Application assigned': t.assignedAction,
    'Document verification started': t.verificationStarted,
    'Documents verified': t.documentsVerified,
    'Application returned': t.returnedAction,
    'Application resubmitted': t.resubmittedAction,
    'Document checked': t.documentChecked,
    'Document uploaded': t.documentUploadedAction,
    'Document replaced': t.documentReplacedAction,
    'Document viewed': t.documentViewedAction,
    'Document deleted': t.documentDeletedAction,
    'Document verified': t.documentVerifiedAction,
    'Document returned for correction': t.documentCorrectionAction,
    'Document check updated': t.documentUpdatedAction,
    'Missing documents requested': t.missingRequested,
    'Field verification started': t.fieldStartedAction,
    'Field verification completed': t.fieldCompletedAction,
    'AI document review generated': t.aiDocumentsAction,
    'AI field verification checklist generated': t.aiChecklistAction,
    'AI field observation summary generated': t.aiFieldSummaryAction,
    'AI application review summary generated': t.aiApplicationSummaryAction,
  }
  return (
    <div className="content management-content detail-content">
      <div className="detail-back-row"><button className="back-link" onClick={() => navigate('/applications')}><ArrowLeft size={15} />{t.backToApplications}</button><div className="management-breadcrumb"><Link to="/">{t.dashboard}</Link><ChevronRight size={13} /><Link to="/applications">{t.allApplications}</Link><ChevronRight size={13} /><span>{application.id}</span></div></div>
      <section className="detail-heading panel">
        <div className="detail-heading-main"><span className={`avatar avatar-${application.color}`}>{application.initials}</span><div><span className="detail-kicker">{t.applicationDetails}</span><h1>{application.name}</h1><div className="detail-id-line"><span>{application.id}</span><span className={`management-status status-${application.status.toLowerCase().replaceAll(' ', '-')}`}>{statusLabel(application.status, language)}</span></div></div></div>
        <div className="detail-heading-side"><span className={`priority-label priority-${application.priority.toLowerCase()}`}><i />{priorityLabel(application.priority, language)}</span><div><small>{t.assignedOfficer}</small><strong>{application.assignedOfficer === 'Unassigned' ? t.unassigned : application.assignedOfficer}</strong></div></div>
      </section>

      <div className="detail-layout">
        <div className="detail-main-column">
          <section className="panel detail-section">
            <div className="detail-section-heading"><div className="detail-section-icon"><UserRound size={17} /></div><div><h2>{t.personalInformation}</h2><p>{t.applicationId}: {application.id}</p></div></div>
            <div className="information-grid">
              <Info label={t.applicant} value={application.name} />
              <Info label={t.guardian} value={application.fatherOrGuardian} />
              <Info label={t.address} value={application.address} />
              <Info label={t.district} value={application.district} />
              <Info label={t.block} value={application.block} />
              <Info label={t.gramPanchayat} value={application.gramPanchayat} />
              <Info label={t.annualIncome} value={new Intl.NumberFormat(language === 'or' ? 'or-IN' : 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(application.annualIncome)} />
              <Info label={t.mobile} value={application.mobile} />
              <Info label={t.applicationDate} value={formatDate(application.submittedAt, language, true)} />
              <Info label={t.workflowStatus} value={statusLabel(application.status, language)} />
            </div>
          </section>

          <section className="panel detail-section document-section">
            <div className="detail-section-heading"><div className="detail-section-icon"><FileCheck2 size={17} /></div><div><h2>{t.documents}</h2><p>{t.documentsSub}</p></div></div>
            <div className="document-requirement-note"><AlertCircle size={15} /><span>{t.noteConfig}</span></div>
            <p className="document-size-note">{t.uploadSizeLimit}</p>
            <div className="document-add-panel">
              <label className="document-category-select"><span>{t.newDocumentCategory}</span><select value={newDocumentType} disabled={!documentsEditable || uploadingDocument === 'new'} onChange={(event) => {
                const value = event.currentTarget.value
                if (isDocumentCategory(value)) setNewDocumentType(value)
              }}>{(['identity', 'address', 'income', 'ration', 'supporting', 'other'] as const).map((category) => <option key={category} value={category}>{documentLabel(category, '', language)}</option>)}</select></label>
              <label className="document-option-check"><input type="checkbox" checked={newDocumentApplicable} disabled={!documentsEditable || uploadingDocument === 'new'} onChange={(event) => {
                setNewDocumentApplicable(event.currentTarget.checked)
                if (!event.currentTarget.checked) setNewDocumentRequired(false)
              }} />{t.applicable}</label>
              <label className="document-option-check"><input type="checkbox" checked={newDocumentRequired} disabled={!newDocumentApplicable || !documentsEditable || uploadingDocument === 'new'} onChange={(event) => setNewDocumentRequired(event.currentTarget.checked)} />{t.markRequired}</label>
              <label className={`document-file-button ${!documentsEditable || uploadingDocument === 'new' ? 'document-file-button-disabled' : ''}`}>
                <Upload size={12} />{uploadingDocument === 'new' ? `${t.uploading} ${uploadProgress}%` : t.addDocument}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={!documentsEditable || uploadingDocument === 'new'} onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void addDocumentWithFile(file)
                }} />
              </label>
              {uploadingDocument === 'new' && <progress className="document-add-progress" max={100} value={uploadProgress} aria-label={`${t.uploading} ${uploadProgress}%`} />}
            </div>
            {documentFeedback && <div className={`workflow-feedback ${documentFeedback.type === 'error' ? 'feedback-error' : 'feedback-success'}`} role={documentFeedback.type === 'error' ? 'alert' : 'status'}>{documentFeedback.type === 'error' && <AlertCircle size={15} />}{documentFeedback.message}</div>}
            <div className="document-list">
              {application.documents.map((document) => (
                <article className={`document-row ${!document.applicable ? 'document-not-applicable' : ''}`} key={document.id}>
                  <div className="document-name"><span className="document-icon"><FileText size={16} /></span><div><strong>{documentLabel(document.documentType, document.name, language)}</strong><small>{document.required ? t.required : t.optional} · {document.applicable ? t.applicable : t.notApplicable}</small></div></div>
                  <div className="document-upload">
                    <small>{t.uploadStatus}</small>
                    <span className={`upload-label upload-${document.uploadStatus.toLowerCase()}`}><i />{document.uploadStatus === 'Uploaded' ? t.uploaded : t.missing}</span>
                    {document.originalName && <strong className="document-original-name" title={document.originalName}>{document.originalName}</strong>}
                    {document.uploadedAt && <small>{t.uploadDate}: {formatDate(document.uploadedAt, language, true)}</small>}
                    {uploadingDocument === document.id && <div className="document-upload-progress" role="status"><progress max={100} value={uploadProgress} /><span>{t.uploading} {uploadProgress}%</span></div>}
                    <div className="document-file-actions">
                      {document.uploadStatus === 'Uploaded' && <>
                        <button className="document-action-button" disabled={documentAction === document.id} onClick={() => void previewDocument(document.id, document.originalName ?? document.name, document.mimeType ?? 'application/pdf')}><Eye size={12} />{t.previewFile}</button>
                        <button className="document-action-button" disabled={documentAction === document.id} onClick={() => void downloadDocument(document.id, document.originalName ?? document.name)}><Download size={12} />{t.downloadFile}</button>
                        <button className="document-action-button document-delete-button" disabled={!documentsEditable || documentAction === document.id} onClick={() => void deleteDocument(document.id)}><Trash2 size={12} />{documentAction === document.id ? t.deleting : t.deleteFile}</button>
                      </>}
                      <label className={`document-file-button ${!document.applicable || !documentsEditable || uploadingDocument === document.id ? 'document-file-button-disabled' : ''}`}>
                        <Upload size={12} />{uploadingDocument === document.id ? t.uploading : document.uploadStatus === 'Uploaded' ? t.replaceFile : t.uploadFile}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={!document.applicable || !documentsEditable || uploadingDocument === document.id} onChange={(event) => {
                          const file = event.currentTarget.files?.[0]
                          event.currentTarget.value = ''
                          if (file) void uploadDocument(document.id, file)
                        }} />
                      </label>
                    </div>
                  </div>
                      <div className="document-status"><label htmlFor={`document-${document.id}`}>{t.verification}</label><select id={`document-${document.id}`} value={document.verificationStatus} disabled={!canReviewDocuments || !document.applicable || document.uploadStatus !== 'Uploaded' || application.status !== 'Document verification' || savingDocument === document.id} onChange={(event) => { if (isDocumentVerificationStatus(event.target.value)) void updateDocument(document.id, event.target.value, documentRemarks[document.id] ?? document.remarks) }}><option value="Pending">{t.pending}</option><option value="Verified">{t.verified}</option><option value="Needs correction">{t.needsCorrection}</option></select></div>
                      <div className="document-remarks"><label htmlFor={`remarks-${document.id}`}>{t.remarks}</label><input id={`remarks-${document.id}`} value={documentRemarks[document.id] ?? document.remarks} disabled={!canReviewDocuments || !document.applicable || application.status !== 'Document verification'} placeholder="—" onChange={(event) => setDocumentRemarks((current) => ({ ...current, [document.id]: event.target.value }))} /><button className="document-save" disabled={!canReviewDocuments || !document.applicable || application.status !== 'Document verification' || savingDocument === document.id || (documentRemarks[document.id] ?? document.remarks) === document.remarks} onClick={() => void updateDocument(document.id, document.verificationStatus, documentRemarks[document.id] ?? document.remarks)}>{savingDocument === document.id ? t.saving : t.saveDocument}</button></div>
                </article>
              ))}
            </div>
          </section>

          {preview && <div className="document-preview-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null)
          }}>
            <section className="document-preview-dialog" role="dialog" aria-modal="true" aria-label={t.previewTitle}>
              <div className="document-preview-heading"><div><strong>{t.previewTitle}</strong><small title={preview.name}>{preview.name}</small></div><button className="document-preview-close" aria-label={t.closePreview} onClick={() => setPreview(null)}>×</button></div>
              {preview.mimeType === 'application/pdf'
                ? <iframe className="document-preview-frame" src={preview.url} title={preview.name} sandbox="" />
                : <img className="document-preview-image" src={preview.url} alt={preview.name} />}
            </section>
          </div>}

          <section className="panel detail-section ai-assistant-panel">
            <div className="detail-section-heading"><div className="detail-section-icon"><Brain size={17} /></div><div><h2>{t.aiAssistant}</h2></div></div>
            <div className="ai-disclaimer" role="note"><AlertCircle size={15} /><span>{t.aiDisclaimer}</span></div>
            <div className="ai-actions">
              <button className="secondary-button" disabled={aiBusy} onClick={() => void requestAi(t.aiDocumentReview, () => aiService.reviewDocuments({ applicationId, language }))}><Brain size={14} />{t.aiAnalyzeDocuments}</button>
              <button className="secondary-button" disabled={aiBusy} onClick={() => void requestAi(t.aiFieldChecklist, () => aiService.generateFieldChecklist({ applicationId, language }))}><FileCheck2 size={14} />{t.aiGenerateChecklist}</button>
              <button className="secondary-button" disabled={aiBusy} onClick={() => void requestAi(t.aiApplicationSummary, () => aiService.generateApplicationSummary({ applicationId, language }))}><FileText size={14} />{t.aiGenerateSummary}</button>
            </div>
            <label className="remarks-field ai-observations-field"><span>{t.aiObservations}</span><textarea rows={4} maxLength={5000} value={fieldObservations} disabled={!canEditFieldObservations} onChange={(event) => setFieldObservations(event.target.value)} placeholder={t.aiObservationsPlaceholder} /></label>
            {canEditFieldObservations && <button className="secondary-button ai-summary-button" disabled={savingObservations || !fieldObservations.trim() || fieldObservations === application.fieldObservations} onClick={() => void saveFieldObservations()}><Check size={14} />{savingObservations ? t.saving : t.saveObservations}</button>}
            <button className="primary-button ai-summary-button" disabled={!canEditFieldObservations || aiBusy || !fieldObservations.trim()} onClick={() => void requestAi(t.aiFieldSummary, () => aiService.generateFieldSummary({ applicationId, language, observations: fieldObservations }))}><FileText size={14} />{t.aiSummarizeObservations}</button>
            {aiBusy && <div className="ai-message" role="status"><span className="loading-spinner" />{t.aiBusy}</div>}
            {aiError && <div className="workflow-feedback feedback-error" role="alert"><AlertCircle size={15} />{aiError}</div>}
            {!aiBusy && !aiError && !aiResult && <p className="ai-placeholder">{t.aiNoResult}</p>}
            {aiResult && <div className="ai-result" aria-live="polite">
              <h3>{t.aiOutput}: {aiResult.title}</h3>
              <AiResultContent value={aiResult.data} language={language} />
              <div className="ai-uncertainty"><strong>{t.aiUncertainty}</strong><p>{aiResult.data.uncertainty}</p></div>
              <div className="ai-disclaimer ai-result-warning"><AlertCircle size={15} /><span>{t.aiDisclaimer}</span></div>
            </div>}
          </section>

          <section id="application-history" className="panel detail-section history-section">
            <div className="detail-section-heading"><div className="detail-section-icon"><FileClock size={17} /></div><div><h2>{t.history}</h2><p>{t.historySub}</p></div></div>
            <ol className="history-timeline">
              {[...application.history].reverse().map((entry) => <li key={entry.id}><span className="timeline-node"><Clock3 size={12} /></span><div className="timeline-entry"><div className="timeline-title-row"><strong>{descriptionLabels[entry.action] ?? entry.action}</strong><time>{formatDate(entry.timestamp, language, true)}</time></div><p>{historyDescription(entry, language)}</p><small>{entry.actor}</small></div></li>)}
            </ol>
          </section>
        </div>

        <aside className="detail-side-column">
          <section className="panel workflow-panel">
            <div className="detail-section-heading"><div className="detail-section-icon"><MapPin size={17} /></div><div><h2>{t.actions}</h2><p>{t.actionsSub}</p></div></div>
            {feedback && <div className={`workflow-feedback feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}{feedback.message}</div>}
            <label className="remarks-field"><span>{t.actionRemarks}</span><textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={t.remarksPlaceholder} /></label>
            <div className="workflow-buttons">
              {application.status === 'Application received' && canReviewDocuments && <button className="primary-button" onClick={() => void perform(() => applicationService.startVerification(application.id))}><FileCheck2 size={15} />{t.startVerification}</button>}
              {application.status === 'Document verification' && <>
                {canReviewDocuments && <button className="primary-button" disabled={requiredIncomplete} title={requiredIncomplete ? t.incompleteDocuments : undefined} onClick={() => void perform(() => applicationService.completeDocumentVerification(application.id))}><Check size={15} />{t.completeVerification}</button>}
                {canReviewDocuments && <button className="secondary-button" disabled={!remarks.trim()} onClick={() => void perform(() => applicationService.requestMissingDocuments(application.id, remarks), true)}><FileText size={15} />{t.requestDocuments}</button>}
                {canReviewDocuments && <button className="secondary-button" disabled={!remarks.trim()} onClick={() => void perform(() => applicationService.returnForCorrection(application.id, remarks), true)}><ArrowLeft size={15} />{t.returnCorrection}</button>}
              </>}
              {application.status === 'Field verification' && <>
                {user?.role === 'FIELD_OFFICER' && <button className="primary-button" disabled={!remarks.trim() || !application.fieldObservations.trim()} title={!application.fieldObservations.trim() ? t.fieldObservationsRequired : undefined} onClick={() => void perform(() => applicationService.completeFieldVerification(application.id, remarks), true)}><Check size={15} />{t.completeFieldVerification}</button>}
                {canReviewDocuments && <button className="secondary-button" disabled={!remarks.trim()} onClick={() => void perform(() => applicationService.returnForCorrection(application.id, remarks), true)}><ArrowLeft size={15} />{t.returnCorrection}</button>}
              </>}
              {application.status === 'Returned for correction' && canReviewDocuments && <button className="primary-button" onClick={() => void perform(() => applicationService.resubmit(application.id))}><ArrowRight size={15} />{t.recordResubmission}</button>}
              {application.status === 'Final decision' && canReviewDocuments && <Link className="primary-button" to={`/applications/${encodeURIComponent(application.id)}/review`}><FileCheck2 size={15} />{t.finalReview}<ArrowRight size={14} /></Link>}
              {(application.status === 'Approved' || application.status === 'Rejected') && <Link className="secondary-button" to={`/applications/${encodeURIComponent(application.id)}/review`}><FileText size={15} />{t.finalReview}</Link>}
              {(application.status === 'Approved' || application.status === 'Rejected') && <div className="final-status-note"><Check size={16} />{statusLabel(application.status, language)}</div>}
            </div>
            <div className="workflow-divider" />
            <div className="assign-heading"><strong>{t.assign}</strong><span>{application.assignedOfficer}</span></div>
            {user?.role !== 'FIELD_OFFICER' && <><label className="assign-select"><span className="sr-only">{t.chooseOfficer}</span><select value={officer || application.assignedOfficerId} onChange={(event) => setOfficer(event.target.value)}><option value="" disabled>{t.chooseOfficer}</option>{officers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></label>
            <button className="assign-button" disabled={!officer || officer === application.assignedOfficerId} onClick={() => void perform(() => applicationService.assignOfficer(application.id, officer))}>{t.assignButton}</button></>}
            {application.status === 'Document verification' && <p className="verification-gate">{requiredIncomplete ? <AlertCircle size={14} /> : <Check size={14} />}{requiredIncomplete ? t.incompleteDocuments : t.verified}</p>}
          </section>
        </aside>
      </div>
    </div>
  )
}

const aiFieldLabels: Record<Language, Record<string, string>> = {
  en: {
    findings: 'Findings', checklist: 'Checklist', category: 'Category', severity: 'Severity', title: 'Issue',
    explanation: 'Explanation', recommendedAction: 'Suggested action', documentType: 'Document', state: 'Status',
    note: 'Note', identityQuestions: 'Identity questions', residentialQuestions: 'Residential questions',
    incomeQuestions: 'Income questions', supportingEvidence: 'Supporting evidence', additionalQuestions: 'Additional questions',
    summary: 'Summary', keyObservations: 'Key observations', applicantInformation: 'Applicant information',
    name: 'Name', district: 'District', block: 'Block', annualIncome: 'Annual income', workflowStatus: 'Workflow status',
    submittedDocuments: 'Submitted documents', verifiedDocuments: 'Verified documents', missingInformation: 'Missing information',
    fieldObservations: 'Field observations', outstandingIssues: 'Outstanding issues', suggestedNextSteps: 'Suggested next steps',
    missing_document: 'Missing document', inconsistency: 'Inconsistency', incomplete_information: 'Incomplete information',
    other: 'Other', low: 'Low', medium: 'Medium', high: 'High', uploaded: 'Uploaded', missing: 'Missing',
    not_applicable: 'Not applicable', reviewed: 'Reviewed', needs_review: 'Needs review',
    aadhaar: 'Aadhaar identification', ration: 'Ration card', declaration: 'Income declaration',
    salary: 'Salary certificate / income proof', supporting: 'Other supporting documents',
    'Application received': 'Application received', 'Document verification': 'Document verification',
    'Field verification': 'Field verification', 'Final decision': 'Final decision',
    'Returned for correction': 'Returned for correction', Approved: 'Approved', Rejected: 'Rejected',
  },
  or: {
    findings: 'ଯାଞ୍ଚରେ ମିଳିଥିବା ତଥ୍ୟ', checklist: 'ଯାଞ୍ଚ ତାଲିକା', category: 'ବର୍ଗ', severity: 'ଗୁରୁତ୍ୱ',
    title: 'ବିଷୟ', explanation: 'ବ୍ୟାଖ୍ୟା', recommendedAction: 'ପରାମର୍ଶିତ କାର୍ଯ୍ୟ', documentType: 'ଦସ୍ତାବିଜ',
    state: 'ସ୍ଥିତି', note: 'ଟିପ୍ପଣୀ', identityQuestions: 'ପରିଚୟ ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନ',
    residentialQuestions: 'ବାସସ୍ଥାନ ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନ', incomeQuestions: 'ଆୟ ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନ',
    supportingEvidence: 'ସହାୟକ ପ୍ରମାଣ', additionalQuestions: 'ଅତିରିକ୍ତ ପ୍ରଶ୍ନ', summary: 'ସାରାଂଶ',
    keyObservations: 'ମୁଖ୍ୟ ପର୍ଯ୍ୟବେକ୍ଷଣ', applicantInformation: 'ଆବେଦନକାରୀଙ୍କ ସୂଚନା',
    name: 'ନାମ', district: 'ଜିଲ୍ଲା', block: 'ବ୍ଲକ', annualIncome: 'ବାର୍ଷିକ ଆୟ', workflowStatus: 'କାର୍ଯ୍ୟଧାରା ସ୍ଥିତି',
    submittedDocuments: 'ଦାଖଲ ଦସ୍ତାବିଜ', verifiedDocuments: 'ଯାଞ୍ଚ ହୋଇଥିବା ଦସ୍ତାବିଜ',
    missingInformation: 'ଅପୂର୍ଣ୍ଣ ସୂଚନା', fieldObservations: 'କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ',
    outstandingIssues: 'ବାକି ଥିବା ବିଷୟ', suggestedNextSteps: 'ପରବର୍ତ୍ତୀ ପରାମର୍ଶିତ ପଦକ୍ଷେପ',
    missing_document: 'ଅନୁପସ୍ଥିତ ଦସ୍ତାବିଜ', inconsistency: 'ଅସଙ୍ଗତି', incomplete_information: 'ଅପୂର୍ଣ୍ଣ ସୂଚନା',
    other: 'ଅନ୍ୟାନ୍ୟ', low: 'କମ୍', medium: 'ମଧ୍ୟମ', high: 'ଅଧିକ', uploaded: 'ଅପଲୋଡ୍ ହୋଇଛି',
    missing: 'ଅନୁପସ୍ଥିତ', not_applicable: 'ପ୍ରଯୁଜ୍ୟ ନୁହେଁ', reviewed: 'ଯାଞ୍ଚ ହୋଇଛି', needs_review: 'ଯାଞ୍ଚ ଆବଶ୍ୟକ',
    aadhaar: 'ଆଧାର ପରିଚୟ ପତ୍ର', ration: 'ରାସନ କାର୍ଡ', declaration: 'ଆୟ ଘୋଷଣାପତ୍ର',
    salary: 'ଦରମା ପ୍ରମାଣପତ୍ର / ଆୟ ପ୍ରମାଣ', supporting: 'ଅନ୍ୟାନ୍ୟ ସହାୟକ ଦସ୍ତାବିଜ',
    'Application received': 'ଆବେଦନ ଗ୍ରହଣ ହୋଇଛି', 'Document verification': 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ',
    'Field verification': 'କ୍ଷେତ୍ର ଯାଞ୍ଚ', 'Final decision': 'ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି',
    'Returned for correction': 'ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି', Approved: 'ଅନୁମୋଦିତ', Rejected: 'ପ୍ରତ୍ୟାଖ୍ୟାତ',
  },
}

function AiResultContent({ value, language }: { value: unknown; language: Language }) {
  const labels = aiFieldLabels[language]
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="ai-empty-value">—</p>
    return <ul>{value.map((item, index) => <li key={`${index}-${typeof item === 'string' ? item : 'entry'}`}><AiResultContent value={item} language={language} /></li>)}</ul>
  }
  if (value && typeof value === 'object') {
    return <div className="ai-result-fields">{Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'uncertainty' && key !== 'warning')
      .map(([key, child]) => <section key={key}><strong>{labels[key] ?? key}</strong><AiResultContent value={child} language={language} /></section>)}</div>
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value)
    return <p>{labels[text] ?? text}</p>
  }
  return null
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="information-item"><span>{label}</span><strong>{value}</strong></div>
}
