/**
 * Deploy (Render, v.v.): web và API khác subdomain — đặt
 * `VITE_API_ORIGIN=https://ten-api.onrender.com` (không dấu / cuối; không kèm `/api`).
 * Không đặt hoặc rỗng: dùng `/api` cùng origin (dev có proxy).
 */
function apiOriginBase(): string {
  let raw = String(import.meta.env.VITE_API_ORIGIN ?? '').trim().replace(/\/$/, '')
  if (raw.toLowerCase().endsWith('/api')) {
    raw = raw.slice(0, -4).replace(/\/$/, '')
  }
  return raw === '' ? '' : raw
}

export function apiPath(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`
  const origin = apiOriginBase()
  const prefix = origin === '' ? '/api' : `${origin}/api`
  return `${prefix}${p}`
}

export async function api(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { headers, ...rest } = init
  return fetch(apiPath(path), {
    credentials: 'include',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  })
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const r = await api(path, init)
  const text = await r.text()
  if (!r.ok) {
    let body: unknown = text
    try {
      body = text ? (JSON.parse(text) as unknown) : null
    } catch {
      // keep text
    }
    throw { status: r.status, body } as { status: number; body: unknown }
  }
  if (!text) {
    return undefined as T
  }
  return JSON.parse(text) as T
}
