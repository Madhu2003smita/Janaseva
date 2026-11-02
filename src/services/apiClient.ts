const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api').replace(/\/$/, '')
const tokenStorageKey = 'janaseva.accessToken'

export type ApiUser = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'REVENUE_OFFICER' | 'FIELD_OFFICER'
  district: string
}

export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function getAccessToken() {
  return localStorage.getItem(tokenStorageKey)
}

function storeAccessToken(token: string | null) {
  if (token) localStorage.setItem(tokenStorageKey, token)
  else localStorage.removeItem(tokenStorageKey)
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (authenticated) {
    const token = getAccessToken()
    if (!token) throw new ApiError('Sign in to load JanaSeva applications.', 401, 'UNAUTHENTICATED')
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Unable to connect to the JanaSeva API. Check that the backend is running.', 0, 'API_UNAVAILABLE')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null
    throw new ApiError(payload?.error?.message ?? `API request failed (${response.status}).`, response.status, payload?.error?.code)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function apiErrorFromPayload(payload: unknown, status: number) {
  const error = payload as { error?: { message?: string; code?: string } } | null
  return new ApiError(error?.error?.message ?? `API request failed (${status}).`, status, error?.error?.code)
}

export const apiClient = {
  request,
  upload<T>(path: string, body: FormData, onProgress?: (progress: number) => void): Promise<T> {
    const token = getAccessToken()
    if (!token) return Promise.reject(new ApiError('Sign in to upload JanaSeva documents.', 401, 'UNAUTHENTICATED'))
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${apiBaseUrl}${path}`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
      })
      xhr.addEventListener('error', () => reject(new ApiError('Unable to connect to the JanaSeva API. Check that the backend is running.', 0, 'API_UNAVAILABLE')))
      xhr.addEventListener('abort', () => reject(new ApiError('Document upload was cancelled.', 0, 'UPLOAD_ABORTED')))
      xhr.addEventListener('load', () => {
        let payload: unknown
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : undefined
        } catch {
          reject(new ApiError('The JanaSeva API returned an invalid response.', xhr.status, 'INVALID_API_RESPONSE'))
          return
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(apiErrorFromPayload(payload, xhr.status))
          return
        }
        resolve(payload as T)
      })
      xhr.send(body)
    })
  },
  async download(path: string): Promise<Blob> {
    const token = getAccessToken()
    if (!token) throw new ApiError('Sign in to access JanaSeva documents.', 401, 'UNAUTHENTICATED')
    let response: Response
    try {
      response = await fetch(`${apiBaseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    } catch {
      throw new ApiError('Unable to connect to the JanaSeva API. Check that the backend is running.', 0, 'API_UNAVAILABLE')
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw apiErrorFromPayload(payload, response.status)
    }
    return response.blob()
  },
  login(email: string, password: string) {
    return request<{ token: string; user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false).then((result) => {
      storeAccessToken(result.token)
      return result.user
    })
  },
  async me() {
    const result = await request<{ user: ApiUser }>('/auth/me')
    return result.user
  },
  logout() {
    storeAccessToken(null)
  },
}
