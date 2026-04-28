/**
 * Định dạng phù hợp thuộc tính `value` / `min` / `max` của `<input type="datetime-local" />` (múi giờ local).
 */
export function toDatetimeLocalValue(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Mặc định tạo sự kiện: dự kiến kết thúc = bắt đầu + 2 giờ */
export const EVENT_DEFAULT_END_OFFSET_MS = 2 * 60 * 60 * 1_000

/** Mặc định cuộc họp: kết thúc dự kiến = bắt đầu + 1 giờ 30 phút */
export const MEETING_DEFAULT_END_OFFSET_MS = 90 * 60 * 1_000

/**
 * Từ chuỗi datetime-local, cộng thêm thời lượng (ms) và trả lại chuỗi datetime-local.
 */
export function addDurationDatetimeLocal(
  startValue: string,
  durationMs: number,
): string {
  const d = new Date(startValue)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  return toDatetimeLocalValue(new Date(d.getTime() + durationMs))
}
