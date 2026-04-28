import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { eventStatusLabel } from '@/lib/statusLabels'
import type { EventListItem, ManagedEventsResponse } from '@/types/event'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type ManagedEventsBlockProps = {
  /** Nếu false và không có mục nào, không render (tránh thêm khoảng trống ở trang Sự kiện) */
  showWhenEmpty?: boolean
  className?: string
}

export function ManagedEventsBlock({
  showWhenEmpty = true,
  className,
}: ManagedEventsBlockProps) {
  const [items, setItems] = useState<EventListItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let ok = true
    ;(async () => {
      setErr(null)
      try {
        const r = await apiJson<ManagedEventsResponse>('/events/managed')
        if (ok) {
          setItems(r.items)
        }
      } catch (e) {
        if (ok) {
          setErr(formatApiError(e))
          setItems([])
        }
      }
    })()
    return () => {
      ok = false
    }
  }, [])

  if (items === null) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-3 w-72" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!showWhenEmpty && items.length === 0 && !err) {
    return null
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sự kiện quản lý</CardTitle>
          <CardDescription>
            Các sự kiện bạn đã hoặc đang được phân công quản lý trong hệ thống.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err && (
            <p className="text-destructive text-sm" role="alert">
              {err}
            </p>
          )}
          {!err && items.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Bạn chưa được phân công quản lý sự kiện nào. Khi lãnh đạo thêm
              bạn làm quản lý, danh sách sẽ hiện ở đây.
            </p>
          )}
          {items.length > 0 && (
            <ul className="space-y-0">
              {items.map((ev, i) => (
                <li key={ev.id}>
                  {i > 0 && <div className="bg-border my-2 h-px" />}
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        to={`/app/events/${ev.id}`}
                        className="text-foreground hover:text-primary text-sm font-medium"
                      >
                        {ev.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {new Date(ev.startAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="w-fit shrink-0">
                      {eventStatusLabel(ev.status)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
