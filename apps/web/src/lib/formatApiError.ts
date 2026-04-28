type NestErrorBody = { message?: string | string[] }

function asRecord(v: unknown): NestErrorBody | null {
  if (v && typeof v === 'object' && 'message' in v) {
    return v as NestErrorBody
  }
  return null
}

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
    return e.message
  }
  return 'Đã xảy ra lỗi, vui lòng thử lại.'
}
