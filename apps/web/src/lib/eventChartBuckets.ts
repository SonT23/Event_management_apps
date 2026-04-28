import type { EventListItem } from '@/types/event'

type Bucket = { key: string; label: string; count: number }

/**
 * Nhóm sự kiện theo tháng (bắt đầu) để vẽ biểu đồ trên bảng điều khiển.
 */
export function bucketEventsByStartMonth(
  items: EventListItem[],
  monthsBack = 6,
): Bucket[] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1)
  const buckets: Bucket[] = []
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    buckets.push({
      key,
      label: `${m}/${y}`,
      count: 0,
    })
  }
  const map = new Map(buckets.map((b) => [b.key, b]))
  for (const ev of items) {
    const t = new Date(ev.startAt)
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
    const b = map.get(key)
    if (b) {
      b.count += 1
    }
  }
  return buckets
}
