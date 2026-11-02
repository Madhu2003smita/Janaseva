import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from './useAuth'
import './Auth.css'

const labels = {
  en: {
    title: 'Welcome to JanaSeva', subtitle: 'Sign in to your Odisha revenue office workspace.',
    email: 'Email address', password: 'Password', signIn: 'Sign in securely', signingIn: 'Signing in…',
    signInFailure: 'Sign-in failed. Check your credentials and API connection.',
    showPassword: 'Show password', hidePassword: 'Hide password',
    language: 'ଓଡ଼ିଆ', secure: 'Secure government workspace',
  },
  or: {
    title: 'ଜନସେବାକୁ ସ୍ୱାଗତ', subtitle: 'ଓଡ଼ିଶା ରାଜସ୍ୱ କାର୍ଯ୍ୟାଳୟର କାର୍ଯ୍ୟକ୍ଷେତ୍ରକୁ ପ୍ରବେଶ କରନ୍ତୁ।',
    email: 'ଇମେଲ୍ ଠିକଣା', password: 'ପାସୱାର୍ଡ', signIn: 'ସୁରକ୍ଷିତ ଭାବେ ପ୍ରବେଶ କରନ୍ତୁ', signingIn: 'ପ୍ରବେଶ ହେଉଛି…',
    signInFailure: 'ପ୍ରବେଶ ସଫଳ ହୋଇନାହିଁ। ଆପଣଙ୍କ ପରିଚୟ ସୂଚନା ଓ API ସଂଯୋଗ ଯାଞ୍ଚ କରନ୍ତୁ।',
    showPassword: 'ପାସୱାର୍ଡ ଦେଖନ୍ତୁ', hidePassword: 'ପାସୱାର୍ଡ ଲୁଚାନ୍ତୁ',
    language: 'English', secure: 'ସୁରକ୍ଷିତ ସରକାରୀ କାର୍ଯ୍ୟକ୍ଷେତ୍ର',
  },
}

export function LoginPage({ onLanguageChange, language }: { language: 'en' | 'or'; onLanguageChange: (language: 'en' | 'or') => void }) {
  const { signIn, authError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const t = labels[language]

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch {
      setError(t.signInFailure)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <div className="login-language"><button onClick={() => onLanguageChange(language === 'en' ? 'or' : 'en')}>{t.language}</button></div>
      <section className="login-card">
        <div className="login-brand-mark">ଜ</div>
        <div className="login-brand-caption">ଜନସେବା · ODISHA</div>
        <h1>{t.title}</h1>
        <p className="login-subtitle">{t.subtitle}</p>
        <form onSubmit={submit}>
          <label>{t.email}<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>{t.password}<span className="password-input-wrap"><input type={passwordVisible ? 'text' : 'password'} aria-label={t.password} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button className="password-visibility" type="button" aria-label={passwordVisible ? t.hidePassword : t.showPassword} aria-pressed={passwordVisible} onMouseDown={(event) => event.preventDefault()} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {(error || authError) && <div className="login-error" role="alert">{error || t.signInFailure}</div>}
          <button type="submit" disabled={submitting}>{submitting ? t.signingIn : t.signIn}<ArrowRight size={16} /></button>
        </form>
        <div className="login-secure"><ShieldCheck size={15} />{t.secure}</div>
      </section>
    </main>
  )
}
