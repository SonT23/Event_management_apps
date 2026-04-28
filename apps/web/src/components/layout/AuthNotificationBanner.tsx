import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { Button } from '@/components/ui/button'

/** Hiển thị thông báo chưa đọc sau đăng nhập / refresh; đánh dấu đã đọc qua API. */
export function AuthNotificationBanner() {
  const { user, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const notes = user?.unreadNotifications
  if (!notes?.length) {
    return null
  }

  async function markAllRead() {
    setErr(null)
    setBusy(true)
    try {
      await apiJson('/notifications/read-all', { method: 'POST' })
      await refresh()
    } catch (e) {
      setErr(formatApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="border-border bg-muted/40 text-foreground border-b px-4 py-3 md:px-6"
      role="status"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="min-w-0">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-muted-foreground text-sm leading-snug">{n.body}</p>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={busy}
          onClick={() => void markAllRead()}
        >
          {busy ? 'Đang cập nhật…' : 'Đã xem'}
        </Button>
      </div>
      {err && (
        <p className="text-destructive mt-2 text-xs" role="alert">
          {err}
        </p>
      )}
    </div>
  )
}
