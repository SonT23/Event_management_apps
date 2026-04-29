type NestErrorBody = { message?: string | string[] }

function asRecord(v: unknown): NestErrorBody | null {
  if (v && typeof v === 'object' && 'message' in v) {
    return v as NestErrorBody
  }
  return null
}

const FETCH_HINT =
  'Không kết nối được API. Kiểm tra VITE_API_ORIGIN khi build web, biến CORS_ORIGIN trên API, và Cookie (COOKIE_SAMESITE=none, COOKIE_SECURE=true nếu web và API khác host).'

export function formatApiError(e: unknown): string {
  if (e && typeof e === 'object' && 'body' in e) {
    const b = (e as { body?: unknown }).body
    const rec = asRecord(b)
    if (rec?.message) {
      return Array.isArray(rec.message) ? rec.message.join(', ') : rec.message
    }
    if (typeof b === 'string' && b) {
      return b
    }
  }
  if (e instanceof Error) {
    const m = e.message
    if (
      /^failed to fetch$/i.test(m) ||
      /networkrequestfailed|load failed|network error/i.test(m)
    ) {
      return `${FETCH_HINT} (${m})`
    }
    return m
  }
  return 'Đã xảy ra lỗi, vui lòng thử lại.'
}
