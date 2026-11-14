// Minimal Duffel REST client (https://duffel.com/docs/api). We call the API
// directly rather than through @duffel/api to avoid pulling node-fetch@2 and
// pinned @types/node into the server bundle; shapes follow the v2 API.

export const DUFFEL_API_VERSION = 'v2'
export const DEFAULT_DUFFEL_API_BASE = 'https://api.duffel.com'

export type DuffelErrorCode =
  | 'not_configured'
  | 'aborted'
  | 'timeout'
  | 'network'
  | 'http'
  | 'invalid_response'

export type DuffelApiErrorDetail = {
  code?: string
  title?: string
  message?: string
  type?: string
}

export class DuffelApiError extends Error {
  code: DuffelErrorCode
  status: number | null
  requestId: string | null
  errors: DuffelApiErrorDetail[]
  override cause?: unknown

  constructor(
    code: DuffelErrorCode,
    message: string,
    options: {
      status?: number | null
      requestId?: string | null
      errors?: DuffelApiErrorDetail[]
      cause?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'DuffelApiError'
    this.code = code
    this.status = options.status ?? null
    this.requestId = options.requestId ?? null
    this.errors = options.errors ?? []
    this.cause = options.cause
  }
}

export type DuffelFetch = (input: string, init: RequestInit) => Promise<Response>

export type DuffelHttpClientConfig = {
  accessToken: string | null | undefined
  apiBase?: string | null
  timeoutMs?: number
  fetch?: DuffelFetch
}

export type DuffelRequestInput = {
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string | number | boolean | null | undefined>
  data?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

export type DuffelHttpClient = {
  isConfigured: boolean
  isLiveMode: boolean
  request<T>(input: DuffelRequestInput): Promise<T>
}

const DEFAULT_TIMEOUT_MS = 20_000

const buildUrl = (base: string, path: string, query: DuffelRequestInput['query']) => {
  const url = new URL(path.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`)
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null) continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

const readErrorDetails = (body: unknown): DuffelApiErrorDetail[] => {
  if (!body || typeof body !== 'object' || !('errors' in body)) return []
  const errors = (body as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return []
  return errors
    .filter((error): error is Record<string, unknown> => !!error && typeof error === 'object')
    .map((error) => ({
      code: typeof error.code === 'string' ? error.code : undefined,
      title: typeof error.title === 'string' ? error.title : undefined,
      message: typeof error.message === 'string' ? error.message : undefined,
      type: typeof error.type === 'string' ? error.type : undefined,
    }))
}

export const createDuffelHttpClient = (config: DuffelHttpClientConfig): DuffelHttpClient => {
  const accessToken = String(config.accessToken || '').trim()
  const apiBase = String(config.apiBase || '').trim() || DEFAULT_DUFFEL_API_BASE
  const doFetch: DuffelFetch = config.fetch || ((input, init) => fetch(input, init))

  return {
    isConfigured: accessToken.length > 0,
    isLiveMode: accessToken.startsWith('duffel_live_'),

    async request<T>(input: DuffelRequestInput): Promise<T> {
      if (!accessToken) {
        throw new DuffelApiError('not_configured', 'Duffel access token is not configured.')
      }
      if (input.signal?.aborted) {
        throw new DuffelApiError('aborted', 'Duffel request was aborted.')
      }

      const timeoutMs = input.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS
      const controller = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
      const onAbort = () => controller.abort()
      input.signal?.addEventListener('abort', onAbort, { once: true })

      let response: Response
      try {
        response = await doFetch(buildUrl(apiBase, input.path, input.query), {
          method: input.method,
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'Content-Type': 'application/json',
            'Duffel-Version': DUFFEL_API_VERSION,
            Authorization: `Bearer ${accessToken}`,
          },
          body: input.data === undefined ? undefined : JSON.stringify({ data: input.data }),
          signal: controller.signal,
        })
      } catch (error) {
        if (timedOut) {
          throw new DuffelApiError('timeout', `Duffel request timed out after ${timeoutMs}ms.`, {
            cause: error,
          })
        }
        if (input.signal?.aborted) {
          throw new DuffelApiError('aborted', 'Duffel request was aborted.', { cause: error })
        }
        throw new DuffelApiError('network', 'Duffel request failed.', { cause: error })
      } finally {
        clearTimeout(timer)
        input.signal?.removeEventListener('abort', onAbort)
      }

      const requestId = response.headers.get('x-request-id')
      let body: unknown = null
      try {
        const text = await response.text()
        body = text ? JSON.parse(text) : null
      } catch (error) {
        throw new DuffelApiError('invalid_response', 'Duffel returned a non-JSON response.', {
          status: response.status,
          requestId,
          cause: error,
        })
      }

      if (!response.ok) {
        const errors = readErrorDetails(body)
        const summary = errors[0]?.message || errors[0]?.title || `HTTP ${response.status}`
        throw new DuffelApiError('http', `Duffel request failed: ${summary}`, {
          status: response.status,
          requestId,
          errors,
        })
      }

      if (!body || typeof body !== 'object' || !('data' in body)) {
        throw new DuffelApiError('invalid_response', 'Duffel response is missing data.', {
          status: response.status,
          requestId,
        })
      }

      return (body as { data: T }).data
    },
  }
}
