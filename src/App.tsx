import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileClock,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react'
import { ApplicationDetailsPage, ApplicationsPage } from './ApplicationManagement'
import { FinalReviewPage } from './FinalReview'
import { LoginPage } from './Auth'
import { ApplicationHistoryPage, SettingsPage, TeamManagementPage, type Language } from './WorkspacePages'
import { useAuth } from './useAuth'
import { applicationService, type DashboardSummary, type WorkflowStatus } from './services/applicationService'
import './App.css'

type ApplicationStatus = 'Pending' | 'In review' | 'Needs attention'

type Application = {
  id: string
  name: string
  initials: string
  district: string
  submitted: string
  stage: string
  status: ApplicationStatus
  color: string
}

const words = {
  en: {
    dashboard: 'Dashboard', applications: 'Applications', allApplications: 'All applications',
    history: 'Application history', team: 'Team management', settings: 'Settings',
    overview: 'Overview', greeting: 'Good morning', subtitle: 'Here’s what’s happening with your applications today.',
    live: 'LIVE OVERVIEW', today: 'Today', total: 'Total applications', pending: 'Pending review',
    attention: 'Needs attention', approved: 'Approved', vs: 'vs. last month', queue: 'Application queue',
    queueSub: 'Review and track recently submitted applications.', viewAll: 'View all applications',
    search: 'Search by name or application ID', allStatus: 'All statuses', applicant: 'Applicant',
    applicationId: 'Application ID', stage: 'Current stage', date: 'Submitted', status: 'Status',
    priority: 'Priority alerts', prioritySub: 'Applications that need your attention',
    overdue: 'Verification overdue', overdueSub: '3 applications have been waiting for field verification for more than 5 days.',
    documents: 'Documents missing', documentsSub: '2 applicants have not submitted all required documents.',
    reviewAlerts: 'Review alerts', activity: 'Recent activity', activitySub: 'Latest updates across your office',
    allActivity: 'All activity', viewDetails: 'View details', seeAll: 'See all',
    assigned: 'was assigned to Field Officer', docsChecked: 'documents were verified by', moved: 'moved to final decision',
    minutes: 'min ago', hour: 'hour ago', hours: 'hours ago', yesterday: 'Yesterday',
    officer: 'Revenue Officer', office: 'Khordha Revenue Division', online: 'Online',
    notifications: 'Notifications', noNotifications: 'You’re all caught up.', navSoon: 'This section will be available in a later phase.',
    noResults: 'No applications match your search.', showing: 'Showing', of: 'of',
    menu: 'Open navigation menu', close: 'Close navigation menu',
    noPriority: 'No applications need immediate attention.', dashboardError: 'Dashboard data is unavailable.',
    overdueCount: 'applications have been waiting for field verification for more than 5 days.',
    missingCount: 'applicants have not submitted all applicable required documents.',
    updatedJustNow: 'Just now', approvedAction: 'Application approved', rejectedAction: 'Application rejected',
    submittedAction: 'Application submitted', checkedAction: 'Document checked', returnedAction: 'Application returned',
    assignedAction: 'Application assigned', otherAction: 'Application updated', signOut: 'Sign out',
  },
  or: {
    dashboard: 'ଡ୍ୟାସବୋର୍ଡ', applications: 'ଆବେଦନ', allApplications: 'ସମସ୍ତ ଆବେଦନ',
    history: 'ଆବେଦନ ଇତିହାସ', team: 'ଦଳ ପରିଚାଳନା', settings: 'ସେଟିଂସ',
    overview: 'ସାରାଂଶ', greeting: 'ସୁପ୍ରଭାତ', subtitle: 'ଆଜି ଆପଣଙ୍କ ଆବେଦନଗୁଡ଼ିକର ସ୍ଥିତି।',
    live: 'ବର୍ତ୍ତମାନର ସ୍ଥିତି', today: 'ଆଜି', total: 'ମୋଟ ଆବେଦନ', pending: 'ସମୀକ୍ଷା ଅପେକ୍ଷାରେ',
    attention: 'ଧ୍ୟାନ ଆବଶ୍ୟକ', approved: 'ଅନୁମୋଦିତ', vs: 'ଗତ ମାସ ତୁଳନାରେ', queue: 'ଆବେଦନ ତାଲିକା',
    queueSub: 'ସମ୍ପ୍ରତି ଦାଖଲ ହୋଇଥିବା ଆବେଦନଗୁଡ଼ିକୁ ଯାଞ୍ଚ ଏବଂ ଟ୍ରାକ୍ କରନ୍ତୁ।', viewAll: 'ସମସ୍ତ ଆବେଦନ ଦେଖନ୍ତୁ',
    search: 'ନାମ କିମ୍ବା ଆବେଦନ ID ଖୋଜନ୍ତୁ', allStatus: 'ସମସ୍ତ ସ୍ଥିତି', applicant: 'ଆବେଦନକାରୀ',
    applicationId: 'ଆବେଦନ ID', stage: 'ବର୍ତ୍ତମାନର ପର୍ଯ୍ୟାୟ', date: 'ଦାଖଲ ତାରିଖ', status: 'ସ୍ଥିତି',
    priority: 'ଜରୁରୀ ସୂଚନା', prioritySub: 'ଯେଉଁ ଆବେଦନଗୁଡ଼ିକରେ ଧ୍ୟାନ ଦେବା ଆବଶ୍ୟକ',
    overdue: 'ଯାଞ୍ଚ ବିଳମ୍ବ', overdueSub: '୩ଟି ଆବେଦନ ୫ ଦିନରୁ ଅଧିକ ସମୟ ଧରି କ୍ଷେତ୍ର ଯାଞ୍ଚ ପାଇଁ ଅପେକ୍ଷାରେ ଅଛି।',
    documents: 'ଦସ୍ତାବିଜ ଅଭାବ', documentsSub: '୨ ଜଣ ଆବେଦନକାରୀ ସମସ୍ତ ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ଦାଖଲ କରିନାହାନ୍ତି।',
    reviewAlerts: 'ସୂଚନା ଦେଖନ୍ତୁ', activity: 'ସାମ୍ପ୍ରତିକ କାର୍ଯ୍ୟକଳାପ', activitySub: 'ଆପଣଙ୍କ କାର୍ଯ୍ୟାଳୟର ସର୍ବଶେଷ ଅପଡେଟ୍',
    allActivity: 'ସମସ୍ତ କାର୍ଯ୍ୟକଳାପ', viewDetails: 'ବିବରଣୀ ଦେଖନ୍ତୁ', seeAll: 'ସବୁ ଦେଖନ୍ତୁ',
    assigned: 'କ୍ଷେତ୍ର ଅଧିକାରୀଙ୍କୁ ଦିଆଗଲା', docsChecked: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ କଲେ', moved: 'ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି ପାଇଁ ପଠାଗଲା',
    minutes: 'ମିନିଟ୍ ପୂର୍ବେ', hour: 'ଘଣ୍ଟା ପୂର୍ବେ', hours: 'ଘଣ୍ଟା ପୂର୍ବେ', yesterday: 'ଗତକାଲି',
    officer: 'ରାଜସ୍ୱ ଅଧିକାରୀ', office: 'ଖୋର୍ଦ୍ଧା ରାଜସ୍ୱ ବିଭାଗ', online: 'ଅନଲାଇନ୍',
    notifications: 'ବିଜ୍ଞପ୍ତି', noNotifications: 'ଆପଣ ସମସ୍ତ ବିଜ୍ଞପ୍ତି ଦେଖିଛନ୍ତି।', navSoon: 'ଏହି ବିଭାଗ ପରବର୍ତ୍ତୀ ପର୍ଯ୍ୟାୟରେ ଉପଲବ୍ଧ ହେବ।',
    noResults: 'ଆପଣଙ୍କ ଖୋଜ ସହିତ କୌଣସି ଆବେଦନ ମେଳ ଖାଉନାହିଁ।', showing: 'ଦେଖାଯାଉଛି', of: 'ମଧ୍ୟରୁ',
    menu: 'ନାଭିଗେସନ୍ ଖୋଲନ୍ତୁ', close: 'ନାଭିଗେସନ୍ ବନ୍ଦ କରନ୍ତୁ',
    noPriority: 'ତୁରନ୍ତ ଧ୍ୟାନ ଦେବାକୁ କୌଣସି ଆବେଦନ ନାହିଁ।', dashboardError: 'ଡ୍ୟାସବୋର୍ଡ ତଥ୍ୟ ଉପଲବ୍ଧ ନାହିଁ।',
    overdueCount: 'ଟି ଆବେଦନ ୫ ଦିନରୁ ଅଧିକ ସମୟ ଧରି କ୍ଷେତ୍ର ଯାଞ୍ଚ ପାଇଁ ଅପେକ୍ଷାରେ ଅଛି।',
    missingCount: 'ଜଣ ଆବେଦନକାରୀ ସମସ୍ତ ପ୍ରଯୁଜ୍ୟ ଆବଶ୍ୟକ ଦସ୍ତାବିଜ ଦାଖଲ କରିନାହାନ୍ତି।',
    updatedJustNow: 'ବର୍ତ୍ତମାନ', approvedAction: 'ଆବେଦନ ଅନୁମୋଦିତ', rejectedAction: 'ଆବେଦନ ନାକଚ',
    submittedAction: 'ଆବେଦନ ଦାଖଲ', checkedAction: 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ', returnedAction: 'ଆବେଦନ ଫେରସ୍ତ',
    assignedAction: 'ଆବେଦନ ନିଯୁକ୍ତ', otherAction: 'ଆବେଦନ ଅପଡେଟ୍', signOut: 'ପ୍ରସ୍ଥାନ କରନ୍ତୁ',
  },
} satisfies Record<Language, Record<string, string>>

const odiaStatus: Record<ApplicationStatus, string> = {
  Pending: 'ଅପେକ୍ଷାରେ',
  'In review': 'ସମୀକ୍ଷା ଚାଲିଛି',
  'Needs attention': 'ଧ୍ୟାନ ଆବଶ୍ୟକ',
}

const odiaStage: Record<string, string> = {
  'Document verification': 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ',
  'Field verification': 'କ୍ଷେତ୍ର ଯାଞ୍ଚ',
  'Final decision': 'ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି',
}

function dashboardDate(value: string, language: Language) {
  const date = new Date(value)
  const sameDay = date.toDateString() === new Date().toDateString()
  const prefix = sameDay ? (language === 'or' ? 'ଆଜି, ' : 'Today, ') : ''
  return `${prefix}${new Intl.DateTimeFormat(language === 'or' ? 'or-IN' : 'en-IN', {
    ...(sameDay ? {} : { day: 'numeric' }),
    month: 'short',
    ...(sameDay ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)}`
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [language, setLanguageState] = useState<Language>(() => localStorage.getItem('janaseva.language') === 'or' ? 'or' : 'en')
  const [compactDisplay, setCompactDisplayState] = useState(() => localStorage.getItem('janaseva.compactDisplay') === 'true')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [summaryState, setSummaryState] = useState<{ userId: string; value: DashboardSummary } | null>(null)
  const [dashboardErrorState, setDashboardErrorState] = useState<{ userId: string } | null>(null)
  const [now] = useState(() => new Date())
  const t = words[language]
  const location = useLocation()
  const navigate = useNavigate()
  const setLanguage = (nextLanguage: Language) => {
    localStorage.setItem('janaseva.language', nextLanguage)
    setLanguageState(nextLanguage)
  }
  const setCompactDisplay = (compact: boolean) => {
    localStorage.setItem('janaseva.compactDisplay', String(compact))
    setCompactDisplayState(compact)
  }
  const summary = summaryState && user?.id === summaryState.userId ? summaryState.value : null
  const dashboardError = dashboardErrorState && user?.id === dashboardErrorState.userId ? t.dashboardError : ''
  const applicationRecords = useSyncExternalStore(applicationService.subscribe, applicationService.getSnapshot, applicationService.getSnapshot)
  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([applicationService.list({}, 1, 100), applicationService.summary()])
      .then(([, result]) => {
        if (active) {
          setSummaryState({ userId: user.id, value: result })
          setDashboardErrorState(null)
        }
      })
      .catch(() => {
        if (active) setDashboardErrorState({ userId: user.id })
      })
    return () => { active = false }
  }, [user])
  const activeNav = location.pathname === '/history' ? 'Application history'
    : location.pathname === '/team' ? 'Team management'
      : location.pathname === '/settings' ? 'Settings'
        : location.pathname.startsWith('/applications') ? 'Applications' : 'Dashboard'
  const dashboardApplications: Application[] = useMemo(() => applicationRecords.map((record) => {
    const attention = record.status === 'Returned for correction' || record.documents.some((document) => document.applicable && document.verificationStatus === 'Needs correction')
    const status: ApplicationStatus = attention ? 'Needs attention' : ['Field verification', 'Final decision'].includes(record.status) ? 'In review' : 'Pending'
    const workflowStatus: Record<WorkflowStatus, string> = {
      'Application received': 'Document verification',
      'Document verification': 'Document verification',
      'Field verification': 'Field verification',
      'Final decision': 'Final decision',
      'Returned for correction': 'Document verification',
      Approved: 'Final decision',
      Rejected: 'Final decision',
    }
    return {
      id: record.id,
      name: record.name,
      initials: record.initials,
      district: record.district,
      submitted: record.submittedAt,
      stage: workflowStatus[record.status],
      status,
      color: record.color,
    }
  }), [applicationRecords])

  const filteredApplications = useMemo(() => dashboardApplications.filter((application) => {
    const matchesSearch = `${application.name} ${application.id} ${application.district}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'All statuses' || application.status === statusFilter)
  }), [dashboardApplications, search, statusFilter])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  if (authLoading) return <main className="login-screen"><span className="loading-spinner" /></main>
  if (!user) return <LoginPage language={language} onLanguageChange={setLanguage} />

  const navItems = [
    { label: 'Dashboard', text: t.dashboard, icon: LayoutDashboard },
    { label: 'Applications', text: t.applications, icon: FileText, count: summary ? String(summary.total) : '…' },
  ]
  const workItems = [
    { label: 'Application history', text: t.history, icon: FileClock },
    ...(user.role === 'ADMIN' ? [{ label: 'Team management', text: t.team, icon: Users }] : []),
    { label: 'Settings', text: t.settings, icon: Settings },
  ]

  const handleNav = (label: string) => {
    setMenuOpen(false)
    if (label === 'Applications') {
      setStatusFilter('All statuses')
      setSearch('')
      navigate('/applications')
    } else if (label === 'Dashboard') {
      navigate('/')
    } else if (label === 'Application history') {
      navigate('/history')
    } else if (label === 'Team management') {
      navigate('/team')
    } else if (label === 'Settings') {
      navigate('/settings')
    }
  }
  const formattedToday = `${t.today}, ${new Intl.DateTimeFormat(language === 'or' ? 'or-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(now)}`
  const formattedStat = (value?: number) => value === undefined ? '—' : new Intl.NumberFormat(language === 'or' ? 'or-IN' : 'en-IN').format(value)
  const activityActionLabels: Record<string, string> = {
    'Application submitted': t.submittedAction,
    'Application assigned': t.assignedAction,
    'Document checked': t.checkedAction,
    'Missing documents requested': t.returnedAction,
    'Application returned': t.returnedAction,
    'Application approved': t.approvedAction,
    'Application rejected': t.rejectedAction,
  }
  const activityIcon = (action: string) => action.includes('Document') ? FileCheck2 : action.includes('assign') ? BriefcaseBusiness : FileClock
  const relativeTime = (timestamp: string) => {
    const minutes = Math.max(0, Math.floor((now.getTime() - new Date(timestamp).getTime()) / 60000))
    if (minutes < 1) return t.updatedJustNow
    if (minutes < 60) return `${minutes} ${t.minutes}`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} ${t.hours}`
    return dashboardDate(timestamp, language)
  }

  return (
    <div className={`app-shell${compactDisplay ? ' compact-display' : ''}`}>
      <a className="skip-link" href="#main-content">{language === 'or' ? 'ମୁଖ୍ୟ ବିଷୟବସ୍ତୁକୁ ଯାଆନ୍ତୁ' : 'Skip to main content'}</a>
      {menuOpen && <button className="mobile-backdrop" aria-label={t.close} onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span>ଜ</span></div>
          <div className="brand-copy"><strong>JanaSeva</strong><span>ଜନସେବା · ODISHA</span></div>
          <button className="icon-button mobile-close" aria-label={t.close} onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </div>

        <div className="office-switcher">
          <div className="office-emblem"><ShieldAlert size={18} /></div>
          <div className="office-copy"><strong>{user.district}</strong><span>Revenue administration</span></div>
          <ChevronDown size={16} className="muted-icon" />
        </div>

        <div className="nav-section-label">{t.overview}</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ label, text, icon: Icon, count }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} aria-current={activeNav === label ? 'page' : undefined} onClick={() => handleNav(label)}>
              <Icon size={18} strokeWidth={1.8} /><span>{text}</span>{count && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>

        <div className="nav-section-label work-label">{t.history === 'Application history' ? 'WORKSPACE' : 'କାର୍ଯ୍ୟକ୍ଷେତ୍ର'}</div>
        <nav className="side-nav" aria-label="Workspace navigation">
          {workItems.map(({ label, text, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} aria-current={activeNav === label ? 'page' : undefined} onClick={() => handleNav(label)}>
              <Icon size={18} strokeWidth={1.8} /><span>{text}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={17} /></div>
            <strong>Need a hand?</strong>
            <p>Our support team is here to help you.</p>
            <button onClick={() => notify('Support contact: helpdesk@janaseva.odisha.gov.in')}>Contact support <ArrowRight size={14} /></button>
          </div>
          <div className="sidebar-foot"><span className="secure-dot" /> Secure government workspace <span>v1.0.0</span></div>
        </div>
      </aside>

      <main className="main-area" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button className="icon-button hamburger" aria-label={t.menu} onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
            <span>Workspace</span><ChevronRight size={14} /><strong>{activeNav === 'Dashboard' ? t.dashboard : activeNav === 'Application history' ? t.history : activeNav === 'Team management' ? t.team : activeNav === 'Settings' ? t.settings : t.applications}</strong>
          </div>
          <div className="topbar-actions">
            <div className="language-toggle" role="group" aria-label="Choose language">
              <button type="button" className={language === 'en' ? 'selected' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
              <span />
              <button type="button" className={language === 'or' ? 'selected' : ''} aria-pressed={language === 'or'} onClick={() => setLanguage('or')}>ଓଡ଼ିଆ</button>
            </div>
            <div className="action-popover-wrap">
              <button className="icon-button notification-button" aria-label={t.notifications} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false) }}>
                <Bell size={19} /><i />
              </button>
              {notificationsOpen && <div className="popover notification-popover"><strong>{t.notifications}</strong><p>{t.noNotifications}</p></div>}
            </div>
            <div className="topbar-divider" />
            <div className="action-popover-wrap">
              <button className="profile-button" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false) }} aria-expanded={profileOpen}>
                <span className="profile-avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className="profile-copy"><strong>{user.name}</strong><small>{user.role.replaceAll('_', ' ')}</small></span><ChevronDown size={15} />
              </button>
              {profileOpen && <div className="popover profile-popover"><strong>{user.name}</strong><p>{user.email}</p><button onClick={() => { setProfileOpen(false); signOut() }}>{t.signOut}</button></div>}
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/history" element={<ApplicationHistoryPage language={language} />} />
          <Route path="/team" element={<TeamManagementPage language={language} />} />
          <Route path="/settings" element={<SettingsPage language={language} onLanguageChange={setLanguage} compactDisplay={compactDisplay} onCompactDisplayChange={setCompactDisplay} />} />
          <Route path="/applications" element={<ApplicationsPage language={language} />} />
          <Route path="/applications/:applicationId/review" element={<FinalReviewPage language={language} />} />
          <Route path="/applications/:applicationId" element={<ApplicationDetailsPage language={language} />} />
          <Route path="/" element={<div className="content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" />{t.live}</div>
              <h1>{t.greeting}, {user.name.split(' ')[0]}<span className="greeting-period">.</span></h1>
              <p className="welcome-subtitle">{t.subtitle}</p>
            </div>
            <div className="date-chip"><span className="date-dot" />{formattedToday}</div>
          </section>

          {dashboardError && <div className="workflow-feedback feedback-error dashboard-api-error" role="alert"><ShieldAlert size={16} />{dashboardError}</div>}
          <section className="stats-grid" aria-label="Application statistics">
            <article className="stat-card stat-total">
              <div className="stat-top"><span className="stat-icon blue-icon"><FileText size={18} /></span><span className="stat-trend positive"><ArrowUpRight size={14} /></span></div>
              <div className="stat-number">{formattedStat(summary?.total)}</div><div className="stat-label">{t.total}</div>
              <div className="stat-foot"><span>{summary ? t.office : t.dashboardError}</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon amber-icon"><Clock3 size={18} /></span><span className="stat-trend positive"><ArrowDownRight size={14} /></span></div>
              <div className="stat-number">{formattedStat(summary?.pending)}</div><div className="stat-label">{t.pending}</div>
              <div className="stat-foot"><span>{t.office}</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon rose-icon"><ShieldAlert size={18} /></span><span className="stat-trend alert-trend">{t.attention}</span></div>
              <div className="stat-number">{formattedStat(summary?.needsAttention)}</div><div className="stat-label">{t.attention}</div>
              <div className="stat-foot"><span className="stat-foot-mark"><i /></span><span>{t.office}</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon green-icon"><Check size={18} /></span><span className="stat-trend positive"><ArrowUpRight size={14} /></span></div>
              <div className="stat-number">{formattedStat(summary?.approved)}</div><div className="stat-label">{t.approved}</div>
              <div className="stat-foot"><span>{t.office}</span></div>
            </article>
          </section>

          <div className="dashboard-grid">
            <section id="application-queue" className="panel queue-panel">
              <div className="panel-heading">
                <div><h2>{t.queue}</h2><p>{t.queueSub}</p></div>
                <button className="text-link" onClick={() => handleNav('Applications')}>{t.viewAll}<ArrowRight size={15} /></button>
              </div>
              <div className="table-toolbar">
                <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} aria-label={t.search} />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</label>
                <label className="filter-field"><span className="sr-only">{t.status}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Pending</option><option>In review</option><option>Needs attention</option></select><ChevronDown size={14} /></label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>{t.applicant}</th><th>{t.applicationId}</th><th>{t.stage}</th><th>{t.date}</th><th>{t.status}</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {filteredApplications.slice(0, 5).map((application) => (
                      <tr key={application.id}>
                        <td><div className="applicant-cell"><span className={`avatar avatar-${application.color}`}>{application.initials}</span><span><strong>{application.name}</strong><small>{application.district} district</small></span></div></td>
                        <td><span className="application-id">{application.id}</span></td>
                        <td><span className="stage-cell"><span className={`stage-indicator ${application.stage === 'Final decision' ? 'stage-final' : application.stage === 'Field verification' ? 'stage-field' : ''}`} />{language === 'or' ? odiaStage[application.stage] : application.stage}</span></td>
                        <td><span className="date-cell">{dashboardDate(application.submitted, language)}</span></td>
                        <td><span className={`status-pill status-${application.status.toLowerCase().replace(' ', '-')}`}><i />{language === 'or' ? odiaStatus[application.status] : application.status}</span></td>
                        <td><button className="row-action" aria-label={`View ${application.id}`} onClick={() => navigate(`/applications/${application.id}`)}><MoreHorizontal size={19} /></button></td>
                      </tr>
                    ))}
                    {filteredApplications.length === 0 && <tr><td colSpan={6} className="empty-row"><Search size={19} /><span>{t.noResults}</span></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="table-footer"><span>{t.showing} <strong>{Math.min(filteredApplications.length, 5)}</strong> {t.of} <strong>{summary?.total ?? 0}</strong> applications</span><div className="pagination"><button aria-label="Previous page" disabled><ChevronLeft size={16} /></button><button className="page-current">1</button><button onClick={() => handleNav('Applications')}>2</button><button aria-label="Next page" onClick={() => handleNav('Applications')}><ChevronRight size={16} /></button></div></div>
            </section>

            <aside className="right-column">
              <section className="panel priority-panel">
                <div className="panel-heading compact-heading"><div><div className="priority-title"><h2>{t.priority}</h2><span className="alert-count">{formattedStat((summary?.overdueFieldVerifications ?? 0) + (summary?.missingDocuments ?? 0))}</span></div><p>{t.prioritySub}</p></div><button className="icon-button more-button" aria-label="More priority alert options" onClick={() => handleNav('Applications')}><MoreHorizontal size={19} /></button></div>
                {(summary?.overdueFieldVerifications ?? 0) > 0 && <article className="alert-card alert-overdue">
                  <div className="alert-icon"><Clock3 size={17} /></div>
                  <div className="alert-copy"><strong>{t.overdue}</strong><p>{formattedStat(summary?.overdueFieldVerifications)} {t.overdueCount}</p><button onClick={() => handleNav('Applications')}>{t.reviewAlerts}<ArrowRight size={13} /></button></div>
                </article>}
                {(summary?.missingDocuments ?? 0) > 0 && <article className="alert-card alert-documents">
                  <div className="alert-icon"><FileCheck2 size={17} /></div>
                  <div className="alert-copy"><strong>{t.documents}</strong><p>{formattedStat(summary?.missingDocuments)} {t.missingCount}</p><button onClick={() => handleNav('Applications')}>{t.reviewAlerts}<ArrowRight size={13} /></button></div>
                </article>}
                {(summary?.overdueFieldVerifications ?? 0) + (summary?.missingDocuments ?? 0) === 0 && <div className="activity-empty-priority">{summary ? t.noPriority : t.dashboardError}</div>}
                <div className="alert-panel-foot"><span><span className="small-alert-dot" /> {formattedStat(summary?.needsAttention)} {t.attention}</span><button onClick={() => handleNav('Applications')}>{t.seeAll}<ArrowRight size={13} /></button></div>
              </section>

              <section className="panel activity-panel">
                <div className="panel-heading compact-heading"><div><h2>{t.activity}</h2><p>{t.activitySub}</p></div><button className="activity-filter" onClick={() => notify('Showing recent activity from your office')}>{t.allActivity}<ChevronDown size={13} /></button></div>
                <div className="activity-list">
                  {summary?.recentActivity.slice(0, 4).map((activity, index) => {
                    const Icon = activityIcon(activity.action)
                    const name = applicationRecords.find((record) => record.id === activity.applicationId)?.name ?? activity.applicantName
                    const color = ['blue', 'rose', 'violet', 'green'][index] ?? 'blue'
                    return <button className="activity-item activity-item-button" key={activity.id} onClick={() => navigate(`/applications/${activity.applicationId}#history`)}><div className="activity-avatar-wrap"><span className={`avatar avatar-${color}`}>{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span className={`activity-type type-${color}`}><Icon size={10} /></span></div><div className="activity-copy"><p><strong>{name}</strong> · {activityActionLabels[activity.action] ?? t.otherAction} · <strong>{activity.actor}</strong></p><span>{relativeTime(activity.timestamp)} <i /> {activity.applicationId}</span></div></button>
                  })}
                  {summary && summary.recentActivity.length === 0 && <div className="activity-empty-priority">{t.noPriority}</div>}
                </div>
                <button className="activity-see-all" onClick={() => handleNav('Application history')}>{t.allActivity}<ArrowRight size={14} /></button>
              </section>
            </aside>
          </div>

          <footer className="page-footer"><span>© 2026 JanaSeva · Government of Odisha</span><span><i /> {t.online}</span></footer>
          </div>} />
          <Route path="*" element={<ApplicationsPage language={language} />} />
        </Routes>
      </main>
      {toast && <div className="toast-message" role="status"><Check size={16} />{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><X size={14} /></button></div>}
    </div>
  )
}

export default App
