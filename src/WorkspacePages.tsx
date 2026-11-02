import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, LogOut, Plus, Search, X } from 'lucide-react'
import { useAuth } from './useAuth'
import type { ApplicationHistoryEntry } from './services/applicationService'
import { ApiError } from './services/apiClient'
import { workspaceService, type ManagedUser, type ManagedUserInput } from './services/workspaceService'
import './WorkspacePages.css'

export type Language = 'en' | 'or'
type Copy = {
  title: string
  subtitle: string
  search: string
  role: string
  district: string
  status: string
  allRoles: string
  allDistricts: string
  allStatuses: string
  active: string
  inactive: string
  name: string
  email: string
  password: string
  create: string
  edit: string
  save: string
  cancel: string
  createUser: string
  editUser: string
  fieldOfficer: string
  revenueOfficer: string
  administrator: string
  noUsers: string
  loadError: string
  saved: string
  required: string
  noPermission: string
  from: string
  to: string
  action: string
  officer: string
  applicationId: string
  date: string
  remarks: string
  noHistory: string
  historyTitle: string
  historySubtitle: string
  enterApplicationId: string
  loadHistory: string
  historyError: string
  allActions: string
  allOfficers: string
  statusChange: string
  roleLabel: string
  profile: string
  preferences: string
  language: string
  english: string
  odia: string
  display: string
  compact: string
  comfortable: string
  account: string
  logout: string
  logoutConfirm: string
  confirm: string
  profileDescription: string
}

const translations: Record<Language, Copy> = {
  en: {
    title: 'Team management', subtitle: 'Create and manage officer accounts and access.',
    search: 'Search name, email or district', role: 'Role', district: 'District', status: 'Account status',
    allRoles: 'All roles', allDistricts: 'All districts', allStatuses: 'All accounts', active: 'Active',
    inactive: 'Inactive', name: 'Full name', email: 'Email address', password: 'Temporary password',
    create: 'Create account', edit: 'Edit', save: 'Save changes', cancel: 'Cancel',
    createUser: 'Create officer account', editUser: 'Edit officer account', fieldOfficer: 'Field Officer',
    revenueOfficer: 'Revenue Officer', administrator: 'Administrator', noUsers: 'No accounts match your filters.',
    loadError: 'Officer accounts could not be loaded.', saved: 'Account saved.', required: 'Required',
    noPermission: 'Only administrators can manage user accounts.',
    from: 'From date', to: 'To date', action: 'Action', officer: 'Officer',
    applicationId: 'Application ID', date: 'Date', remarks: 'Remarks / decision reason',
    noHistory: 'No history entries match these filters.', enterApplicationId: 'Enter an application ID to search its audit history.',
    historyTitle: 'Application history', historySubtitle: 'Filter the read-only, chronological audit record for an application.',
    loadHistory: 'Search history', historyError: 'History could not be loaded. Check the application ID and your access.',
    allActions: 'All actions', allOfficers: 'All officers',
    statusChange: 'Previous status → New status',
    roleLabel: 'Officer role', profile: 'Profile information', preferences: 'Preferences',
    language: 'Display language', english: 'English', odia: 'Odia',
    display: 'Application display', compact: 'Compact tables', comfortable: 'Comfortable tables',
    account: 'Account settings', logout: 'Sign out securely',
    logoutConfirm: 'Sign out of this JanaSeva session? Your local access token will be removed.',
    confirm: 'Sign out', profileDescription: 'Profile details are managed by your administrator.',
  },
  or: {
    title: 'ଦଳ ପରିଚାଳନା', subtitle: 'ଅଧିକାରୀଙ୍କ ଖାତା ଓ ପ୍ରବେଶ ତିଆରି ଏବଂ ପରିଚାଳନା କରନ୍ତୁ।',
    search: 'ନାମ, ଇମେଲ୍ କିମ୍ବା ଜିଲ୍ଲା ଖୋଜନ୍ତୁ', role: 'ଭୂମିକା', district: 'ଜିଲ୍ଲା', status: 'ଖାତା ସ୍ଥିତି',
    allRoles: 'ସମସ୍ତ ଭୂମିକା', allDistricts: 'ସମସ୍ତ ଜିଲ୍ଲା', allStatuses: 'ସମସ୍ତ ଖାତା',
    active: 'ସକ୍ରିୟ', inactive: 'ନିଷ୍କ୍ରିୟ', name: 'ପୂରା ନାମ', email: 'ଇମେଲ୍ ଠିକଣା',
    password: 'ଅସ୍ଥାୟୀ ପାସୱାର୍ଡ', create: 'ଖାତା ତିଆରି କରନ୍ତୁ', edit: 'ସମ୍ପାଦନା',
    save: 'ପରିବର୍ତ୍ତନ ସଂରକ୍ଷଣ', cancel: 'ବାତିଲ୍', createUser: 'ଅଧିକାରୀ ଖାତା ତିଆରି',
    editUser: 'ଅଧିକାରୀ ଖାତା ସମ୍ପାଦନା', fieldOfficer: 'କ୍ଷେତ୍ର ଅଧିକାରୀ',
    revenueOfficer: 'ରାଜସ୍ୱ ଅଧିକାରୀ', administrator: 'ପ୍ରଶାସକ',
    noUsers: 'ଏହି ଫିଲ୍ଟର ସହିତ କୌଣସି ଖାତା ମିଳିଲା ନାହିଁ।',
    loadError: 'ଅଧିକାରୀଙ୍କ ଖାତା ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।', saved: 'ଖାତା ସଂରକ୍ଷିତ ହୋଇଛି।',
    required: 'ଆବଶ୍ୟକ', noPermission: 'କେବଳ ପ୍ରଶାସକ ହିଁ ଖାତା ପରିଚାଳନା କରିପାରିବେ।',
    from: 'ଏହି ତାରିଖଠାରୁ', to: 'ଏହି ତାରିଖ ପର୍ଯ୍ୟନ୍ତ', action: 'କାର୍ଯ୍ୟ',
    officer: 'ଅଧିକାରୀ', applicationId: 'ଆବେଦନ ID', date: 'ତାରିଖ',
    remarks: 'ମତାମତ / ନିଷ୍ପତ୍ତିର କାରଣ', noHistory: 'ଏହି ଫିଲ୍ଟର ସହିତ କୌଣସି ଇତିହାସ ମିଳିଲା ନାହିଁ।',
    historyTitle: 'ଆବେଦନ ଇତିହାସ', historySubtitle: 'ଆବେଦନର କ୍ରମାନୁସାରୀ, କେବଳ-ପଠନଯୋଗ୍ୟ ଅଡିଟ୍ ରେକର୍ଡ ଫିଲ୍ଟର କରନ୍ତୁ।',
    enterApplicationId: 'ଅଡିଟ୍ ଇତିହାସ ଖୋଜିବାକୁ ଆବେଦନ ID ଲେଖନ୍ତୁ।',
    loadHistory: 'ଇତିହାସ ଖୋଜନ୍ତୁ',
    historyError: 'ଇତିହାସ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ। ଆବେଦନ ID ଓ ଆପଣଙ୍କ ପ୍ରବେଶ ଯାଞ୍ଚ କରନ୍ତୁ।',
    allActions: 'ସମସ୍ତ କାର୍ଯ୍ୟ', allOfficers: 'ସମସ୍ତ ଅଧିକାରୀ',
    statusChange: 'ପୂର୍ବ ସ୍ଥିତି → ନୂଆ ସ୍ଥିତି',
    roleLabel: 'ଅଧିକାରୀଙ୍କ ଭୂମିକା', profile: 'ପ୍ରୋଫାଇଲ୍ ସୂଚନା',
    preferences: 'ପସନ୍ଦ', language: 'ପ୍ରଦର୍ଶନ ଭାଷା', english: 'ଇଂରାଜୀ', odia: 'ଓଡ଼ିଆ',
    display: 'ଆବେଦନ ପ୍ରଦର୍ଶନ', compact: 'ସଂକ୍ଷିପ୍ତ ତାଲିକା', comfortable: 'ସାଧାରଣ ତାଲିକା',
    account: 'ଖାତା ସେଟିଂସ', logout: 'ସୁରକ୍ଷିତ ଭାବେ ସାଇନ୍ ଆଉଟ୍',
    logoutConfirm: 'ଏହି ଜନସେବା ସେସନ୍‌ରୁ ସାଇନ୍ ଆଉଟ୍ କରିବେ କି? ସ୍ଥାନୀୟ ଆକ୍ସେସ୍ ଟୋକେନ୍ ହଟାଯିବ।',
    confirm: 'ସାଇନ୍ ଆଉଟ୍', profileDescription: 'ପ୍ରୋଫାଇଲ୍ ବିବରଣୀ ଆପଣଙ୍କ ପ୍ରଶାସକ ପରିଚାଳନା କରନ୍ତି।',
  },
}

function keepDialogFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
  )]
  if (controls.length === 0) return
  const first = controls[0]!
  const last = controls.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function formatHistoryAction(action: string, language: Language) {
  if (language === 'en') return action
  const labels: Record<string, string> = {
    'Application submitted': 'ଆବେଦନ ଦାଖଲ ହୋଇଛି',
    'Application assigned': 'ଆବେଦନ ନିଯୁକ୍ତ ହୋଇଛି',
    'Application updated': 'ଆବେଦନ ଅପଡେଟ୍ ହୋଇଛି',
    'Document verification started': 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ଆରମ୍ଭ ହୋଇଛି',
    'Documents verified': 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ହୋଇଛି',
    'Missing documents requested': 'ଅନୁପସ୍ଥିତ ଦସ୍ତାବିଜ ମଗାଯାଇଛି',
    'Application returned': 'ଆବେଦନ ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି',
    'Application resubmitted': 'ଆବେଦନ ପୁନଃଦାଖଲ ହୋଇଛି',
    'Field observations recorded': 'କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ରେକର୍ଡ ହୋଇଛି',
    'Field verification started': 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ଆରମ୍ଭ ହୋଇଛି',
    'Field verification completed': 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ସମାପ୍ତ ହୋଇଛି',
    'Application approved': 'ଆବେଦନ ଅନୁମୋଦିତ',
    'Application rejected': 'ଆବେଦନ ପ୍ରତ୍ୟାଖ୍ୟାନ ହୋଇଛି',
    'Document uploaded': 'ଦସ୍ତାବିଜ ଅପଲୋଡ୍ ହୋଇଛି',
    'Document replaced': 'ଦସ୍ତାବିଜ ବଦଳାଯାଇଛି',
    'Document deleted': 'ଦସ୍ତାବିଜ ହଟାଯାଇଛି',
    'Document viewed': 'ଦସ୍ତାବିଜ ଦେଖାଯାଇଛି',
    'Document verified': 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ହୋଇଛି',
    'Document returned for correction': 'ଦସ୍ତାବିଜ ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି',
    'Document check updated': 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ ସ୍ଥିତି ଅପଡେଟ୍ ହୋଇଛି',
    'AI document review generated': 'AI ଦସ୍ତାବିଜ ସମୀକ୍ଷା ତିଆରି ହୋଇଛି',
    'AI field verification checklist generated': 'AI କ୍ଷେତ୍ର ଯାଞ୍ଚ ତାଲିକା ତିଆରି ହୋଇଛି',
    'AI field observation summary generated': 'AI କ୍ଷେତ୍ର ପର୍ଯ୍ୟବେକ୍ଷଣ ସାରାଂଶ ତିଆରି ହୋଇଛି',
    'AI application review summary generated': 'AI ଆବେଦନ ସମୀକ୍ଷା ସାରାଂଶ ତିଆରି ହୋଇଛି',
  }
  return labels[action] ?? action
}

type WorkspacePageProps = {
  language: Language
}

const districts = ['Balasore', 'Cuttack', 'Ganjam', 'Khordha', 'Puri']
const roles: ManagedUser['role'][] = ['ADMIN', 'REVENUE_OFFICER', 'FIELD_OFFICER']

function roleName(role: ManagedUser['role'], t: Copy) {
  if (role === 'ADMIN') return t.administrator
  if (role === 'REVENUE_OFFICER') return t.revenueOfficer
  return t.fieldOfficer
}

export function TeamManagementPage({ language }: WorkspacePageProps) {
  const { user } = useAuth()
  const t = translations[language]
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dialogUser, setDialogUser] = useState<ManagedUser | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    const loadUsers = async () => {
      try {
        const result = await workspaceService.listUsers()
        if (active) setUsers(result)
      } catch (caught) {
        if (active) setError(caught instanceof ApiError && caught.status === 403 ? t.noPermission : t.loadError)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadUsers()
    return () => { active = false }
  }, [t.loadError, t.noPermission])

  const filtered = useMemo(() => users.filter((item) => {
    const matchesText = `${item.name} ${item.email} ${item.district}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    return matchesText
      && (!roleFilter || item.role === roleFilter)
      && (!districtFilter || item.district === districtFilter)
      && (!activeFilter || String(item.active) === activeFilter)
  }), [users, query, roleFilter, districtFilter, activeFilter])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || dialogUser === undefined) return
    const form = new FormData(event.currentTarget)
    const input = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      role: String(form.get('role') ?? 'FIELD_OFFICER') as ManagedUser['role'],
      district: String(form.get('district') ?? ''),
      password: String(form.get('password') ?? ''),
    } satisfies ManagedUserInput
    setSaving(true)
    setError('')
    try {
      if (dialogUser) {
        const updated = await workspaceService.updateUser(dialogUser.id, {
          name: input.name,
          role: input.role,
          district: input.district,
        })
        setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
      } else {
        const created = await workspaceService.createUser(input)
        setUsers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setDialogUser(undefined)
      setNotice(t.saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.loadError)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (account: ManagedUser) => {
    setError('')
    try {
      const updated = await workspaceService.updateUser(account.id, { active: !account.active })
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.loadError)
    }
  }

  if (user?.role !== 'ADMIN') {
    return <main className="workspace-content"><div className="workspace-alert" role="alert"><AlertCircle />{t.noPermission}</div></main>
  }

  return (
    <main className="workspace-content">
      <header className="workspace-title">
        <div><h1>{t.title}</h1><p>{t.subtitle}</p></div>
        <button className="workspace-primary" onClick={() => setDialogUser(null)}><Plus size={17} />{t.createUser}</button>
      </header>
      <section className="workspace-panel" aria-label={t.title}>
        <div className="workspace-filters">
          <label className="workspace-search"><span className="sr-only">{t.search}</span><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /></label>
          <label><span>{t.role}</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">{t.allRoles}</option>{roles.map((role) => <option key={role} value={role}>{roleName(role, t)}</option>)}</select></label>
          <label><span>{t.district}</span><select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}><option value="">{t.allDistricts}</option>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
          <label><span>{t.status}</span><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="">{t.allStatuses}</option><option value="true">{t.active}</option><option value="false">{t.inactive}</option></select></label>
        </div>
        {error && <div className="workspace-alert" role="alert"><AlertCircle size={16} />{error}</div>}
        {notice && <div className="workspace-notice" role="status"><Check size={16} />{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={14} /></button></div>}
        {loading ? <p className="workspace-empty" role="status">…</p> : filtered.length === 0 ? <p className="workspace-empty">{t.noUsers}</p> : (
          <div className="workspace-table-scroll">
            <table className="workspace-table">
              <thead><tr><th>{t.name}</th><th>{t.email}</th><th>{t.role}</th><th>{t.district}</th><th>{t.status}</th><th><span className="sr-only">{t.edit}</span></th></tr></thead>
              <tbody>{filtered.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td><td>{account.email}</td><td>{roleName(account.role, t)}</td><td>{account.district}</td>
                  <td><span className={`workspace-status ${account.active ? 'is-active' : 'is-inactive'}`}>{account.active ? t.active : t.inactive}</span></td>
                  <td className="workspace-row-actions"><button className="workspace-secondary" aria-label={`${t.edit}: ${account.name}`} onClick={() => setDialogUser(account)}>{t.edit}</button>
                    <button className="workspace-link" aria-label={`${account.active ? t.inactive : t.active}: ${account.name}`} onClick={() => void toggleActive(account)}>{account.active ? t.inactive : t.active}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      {dialogUser !== undefined && (
        <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialogUser(undefined) }}>
          <section className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="team-dialog-title"
            onKeyDown={(event) => {
              keepDialogFocus(event)
              if (event.key === 'Escape' && !saving) setDialogUser(undefined)
            }}>
            <h2 id="team-dialog-title">{dialogUser ? t.editUser : t.createUser}</h2>
            <form onSubmit={save}>
              <label>{t.name}<input name="name" required minLength={2} maxLength={120} defaultValue={dialogUser?.name ?? ''} autoFocus /></label>
              <label>{t.email}<input name="email" type="email" required disabled={Boolean(dialogUser)} defaultValue={dialogUser?.email ?? ''} /></label>
              {!dialogUser && <label>{t.password}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>}
              <label>{t.roleLabel}<select name="role" defaultValue={dialogUser?.role ?? 'FIELD_OFFICER'}>{roles.map((role) => <option key={role} value={role}>{roleName(role, t)}</option>)}</select></label>
              <label>{t.district}<select name="district" defaultValue={dialogUser?.district ?? user?.district ?? 'Khordha'} required>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
              {error && <div className="workspace-alert" role="alert">{error}</div>}
              <div className="workspace-dialog-actions"><button type="button" className="workspace-secondary" disabled={saving} onClick={() => setDialogUser(undefined)}>{t.cancel}</button>
                <button className="workspace-primary" type="submit" disabled={saving}>{saving ? '…' : dialogUser ? t.save : t.create}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

function formatStatus(status: ApplicationHistoryEntry['previousStatus'], language: Language) {
  if (!status) return '—'
  const labels: Record<string, [string, string]> = {
    'Application received': ['Application received', 'ଆବେଦନ ଗ୍ରହଣ ହୋଇଛି'],
    'Document verification': ['Document verification', 'ଦସ୍ତାବିଜ ଯାଞ୍ଚ'],
    'Field verification': ['Field verification', 'କ୍ଷେତ୍ର ଯାଞ୍ଚ'],
    'Final decision': ['Final decision', 'ଚୂଡ଼ାନ୍ତ ନିଷ୍ପତ୍ତି'],
    'Returned for correction': ['Returned for correction', 'ସଂଶୋଧନ ପାଇଁ ଫେରାଯାଇଛି'],
    Approved: ['Approved', 'ଅନୁମୋଦିତ'],
    Rejected: ['Rejected', 'ପ୍ରତ୍ୟାଖ୍ୟାନ'],
  }
  return labels[status]?.[language === 'en' ? 0 : 1] ?? status
}

function roleForHistory(role: ApplicationHistoryEntry['actorRole'], language: Language) {
  if (!role) return ''
  const label = role === 'ADMIN' ? 'Administrator' : role === 'REVENUE_OFFICER' ? 'Revenue Officer' : 'Field Officer'
  const odia = role === 'ADMIN' ? 'ପ୍ରଶାସକ' : role === 'REVENUE_OFFICER' ? 'ରାଜସ୍ୱ ଅଧିକାରୀ' : 'କ୍ଷେତ୍ର ଅଧିକାରୀ'
  return language === 'en' ? label : odia
}

export function ApplicationHistoryPage({ language }: WorkspacePageProps) {
  const t = translations[language]
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialApplicationId] = useState(() => searchParams.get('applicationId'))
  const [applicationId, setApplicationId] = useState(initialApplicationId ?? '')
  const [entries, setEntries] = useState<ApplicationHistoryEntry[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [officerFilter, setOfficerFilter] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const loadHistory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = applicationId.trim()
    if (!normalized) return
    setLoading(true)
    setError('')
    setSearched(true)
    setEntries([])
    try {
      const result = await workspaceService.getApplicationHistory(normalized)
      setEntries(result)
      setSearchParams({ applicationId: normalized }, { replace: true })
    } catch {
      setError(t.historyError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialApplicationId) return
    const form = document.querySelector<HTMLFormElement>('#history-search-form')
    if (form) form.requestSubmit()
  }, [initialApplicationId])

  const actions = useMemo(() => [...new Set(entries.map((entry) => entry.action))].sort(), [entries])
  const officers = useMemo(() => [...new Set(entries.map((entry) => entry.actor))].sort(), [entries])
  const filtered = useMemo(() => entries.filter((entry) => {
    const timestamp = new Date(entry.timestamp).getTime()
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY
    return timestamp >= fromTime && timestamp <= toTime
      && (!actionFilter || entry.action === actionFilter)
      && (!officerFilter || entry.actor === officerFilter)
  }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)), [entries, from, to, actionFilter, officerFilter])

  return (
    <main className="workspace-content">
      <header className="workspace-title"><div><h1>{t.historyTitle}</h1><p>{t.historySubtitle}</p></div></header>
      <section className="workspace-panel">
        <form id="history-search-form" className="history-search" onSubmit={(event) => void loadHistory(event)}>
          <label>{t.applicationId}<input value={applicationId} onChange={(event) => setApplicationId(event.target.value)} placeholder="INC-2026-0012" /></label>
          <button className="workspace-primary" type="submit" disabled={loading || !applicationId.trim()}><Search size={16} />{t.loadHistory}</button>
        </form>
        {!searched && <p className="workspace-empty">{t.enterApplicationId}</p>}
        {loading && <p className="workspace-empty" role="status">…</p>}
        {error && <div className="workspace-alert" role="alert"><AlertCircle size={16} />{error}</div>}
        {searched && !loading && !error && (
          <>
            <div className="workspace-filters history-filters">
              <label><span>{t.from}</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
              <label><span>{t.to}</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
              <label><span>{t.action}</span><select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}><option value="">{t.allActions}</option>{actions.map((action) => <option key={action} value={action}>{formatHistoryAction(action, language)}</option>)}</select></label>
              <label><span>{t.officer}</span><select value={officerFilter} onChange={(event) => setOfficerFilter(event.target.value)}><option value="">{t.allOfficers}</option>{officers.map((officer) => <option key={officer}>{officer}</option>)}</select></label>
            </div>
            {filtered.length === 0 ? <p className="workspace-empty">{t.noHistory}</p> : (
              <div className="workspace-table-scroll">
                <table className="workspace-table history-table">
                  <thead><tr><th>{t.date}</th><th>{t.action}</th><th>{t.officer}</th><th>{t.statusChange}</th><th>{t.remarks}</th></tr></thead>
                  <tbody>{filtered.map((entry) => (
                    <tr key={entry.id}>
                      <td><time dateTime={entry.timestamp}>{new Intl.DateTimeFormat(language === 'or' ? 'or-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.timestamp))}</time></td>
                      <td>{formatHistoryAction(entry.action, language)}</td>
                      <td>{entry.actor}<small className="workspace-subline">{roleForHistory(entry.actorRole, language)}</small></td>
                      <td>{formatStatus(entry.previousStatus, language)} → {formatStatus(entry.newStatus, language)}</td>
                      <td className="history-remarks">{entry.description || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

type SettingsPageProps = WorkspacePageProps & {
  onLanguageChange(language: Language): void
  compactDisplay: boolean
  onCompactDisplayChange(compact: boolean): void
}

export function SettingsPage({ language, onLanguageChange, compactDisplay, onCompactDisplayChange }: SettingsPageProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const t = translations[language]
  const [confirmLogout, setConfirmLogout] = useState(false)

  const logout = () => {
    signOut()
    navigate('/', { replace: true })
  }

  return (
    <main className="workspace-content settings-content">
      <header className="workspace-title"><div><h1>{language === 'en' ? 'Settings' : 'ସେଟିଂସ'}</h1><p>{language === 'en' ? 'Personalize your workspace and manage your current session.' : 'ଆପଣଙ୍କ କାର୍ଯ୍ୟକ୍ଷେତ୍ର ପସନ୍ଦ ଓ ବର୍ତ୍ତମାନର ସେସନ୍ ପରିଚାଳନା କରନ୍ତୁ।'}</p></div></header>
      <div className="settings-grid">
        <section className="workspace-panel settings-card">
          <h2>{t.profile}</h2><p>{t.profileDescription}</p>
          <dl className="profile-details">
            <div><dt>{t.name}</dt><dd>{user?.name}</dd></div>
            <div><dt>{t.email}</dt><dd>{user?.email}</dd></div>
            <div><dt>{t.roleLabel}</dt><dd>{user ? roleName(user.role, t) : ''}</dd></div>
            <div><dt>{t.district}</dt><dd>{user?.district}</dd></div>
          </dl>
        </section>
        <section className="workspace-panel settings-card">
          <h2>{t.preferences}</h2>
          <fieldset className="settings-choice"><legend>{t.language}</legend>
            <label><input type="radio" name="language" checked={language === 'en'} onChange={() => onLanguageChange('en')} />{t.english}</label>
            <label><input type="radio" name="language" checked={language === 'or'} onChange={() => onLanguageChange('or')} />{t.odia}</label>
          </fieldset>
          <fieldset className="settings-choice"><legend>{t.display}</legend>
            <label><input type="radio" name="display" checked={!compactDisplay} onChange={() => onCompactDisplayChange(false)} />{t.comfortable}</label>
            <label><input type="radio" name="display" checked={compactDisplay} onChange={() => onCompactDisplayChange(true)} />{t.compact}</label>
          </fieldset>
        </section>
        <section className="workspace-panel settings-card settings-account">
          <h2>{t.account}</h2>
          <button className="workspace-danger" onClick={() => setConfirmLogout(true)}><LogOut size={16} />{t.logout}</button>
        </section>
      </div>
      {confirmLogout && <div className="workspace-dialog-backdrop">
        <section className="workspace-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title"
          onKeyDown={(event) => {
            keepDialogFocus(event)
            if (event.key === 'Escape') setConfirmLogout(false)
          }}>
          <h2 id="logout-title">{t.logout}</h2><p>{t.logoutConfirm}</p>
          <div className="workspace-dialog-actions"><button className="workspace-secondary" autoFocus onClick={() => setConfirmLogout(false)}>{t.cancel}</button><button className="workspace-danger" onClick={logout}>{t.confirm}</button></div>
        </section>
      </div>}
    </main>
  )
}