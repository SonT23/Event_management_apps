const API = '/api'

export function apiPath(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API}${p}`
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
