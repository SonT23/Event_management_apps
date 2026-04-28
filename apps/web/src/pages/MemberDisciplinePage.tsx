import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { isClubLeadership, roleCodesFromUser } from '@/lib/roles'
import type { EventListResponse } from '@/types/event'
import type { MemberDisciplineResponse, MemberDisciplineRow } from '@/types/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function currentQuarterY() {
  const d = new Date()
  return {
    year: d.getFullYear(),
    quarter: (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
  }
}

function buildDisciplineQuery(
  eventId: string,
  period: 'all' | 'quarter',
  year: number,
  quarter: 1 | 2 | 3 | 4,
) {
  const p = new URLSearchParams()
  if (eventId) {
    p.set('eventId', eventId)
  } else {
    p.set('period', period)
    if (period === 'quarter') {
      p.set('year', String(year))
      p.set('quarter', String(quarter))
    }
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

function splitRanking(rows: MemberDisciplineRow[]) {
  const withPart = rows.filter((r) => r.eventsParticipated > 0)
  const noPart = rows
    .filter((r) => r.eventsParticipated === 0)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
  const asc = [...withPart].sort(
    (a, b) =>
      a.score - b.score || a.fullName.localeCompare(b.fullName, 'vi'),
  )
  const desc = [...withPart].sort(
    (a, b) =>
      b.score - a.score || a.fullName.localeCompare(b.fullName, 'vi'),
  )
  return { asc, desc, noPart }
}

function MiniScoreTable({
  title,
  description,
  rows,
  showScore,
  emptyHint,
  className,
}: {
  title: string
  description: string
  rows: MemberDisciplineRow[]
  showScore: boolean
  emptyHint: string
  className?: string
}) {
  return (
    <Card
      className={cn(
        'border-border/60 flex h-full min-h-0 flex-col overflow-hidden shadow-sm',
        className,
      )}
    >
      <CardHeader className="shrink-0 space-y-1 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-muted-foreground tabular-nums text-xs">
            {rows.length} người
          </span>
        </div>
        <CardDescription className="text-xs leading-snug">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden px-2 pb-2 pt-0 sm:px-3">
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-2 text-sm">{emptyHint}</p>
        ) : (
          <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead>Thành viên</TableHead>
                  {showScore && (
                    <TableHead className="w-24 text-right">Tổng điểm</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.userId}>
                    <TableCell className="text-muted-foreground w-8 text-center text-xs tabular-nums">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium leading-tight">
                        {r.fullName}
                      </div>
                      <div className="text-muted-foreground max-w-[12rem] truncate text-xs sm:max-w-[14rem]">
                        {r.email}
                      </div>
                    </TableCell>
                    {showScore && (
                      <TableCell className="text-right text-base font-semibold tabular-nums">
                        {r.score}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MemberDisciplinePage() {
  const { user } = useAuth()
  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false
  const [eventId, setEventId] = useState<string>('')
  const { year: defaultY, quarter: defaultQ } = currentQuarterY()
  const [period, setPeriod] = useState<'all' | 'quarter'>('quarter')
  const [qYear, setQYear] = useState(defaultY)
  const [qNum, setQNum] = useState<1 | 2 | 3 | 4>(defaultQ)
  const [events, setEvents] = useState<{ id: string; title: string }[]>([])
  const [data, setData] = useState<MemberDisciplineResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lead) {
      setLoading(false)
      return
    }
    let ok = true
    ;(async () => {
      try {
        const ev = await apiJson<EventListResponse>(
          '/events?page=1&pageSize=200',
        )
        if (ok) {
          setEvents(ev.items.map((e) => ({ id: e.id, title: e.title })))
        }
      } catch {
        // bỏ qua
      }
    })()
    return () => {
      ok = false
    }
  }, [lead])

  useEffect(() => {
    if (!lead) {
      return
    }
    let ok = true
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const q = buildDisciplineQuery(eventId, period, qYear, qNum)
        const r = await apiJson<MemberDisciplineResponse>(
          `/analytics/member-discipline${q}`,
        )
        if (ok) {
          setData(r)
        }
      } catch (e) {
        if (ok) {
          setErr(formatApiError(e))
          setData(null)
        }
      } finally {
        if (ok) {
          setLoading(false)
        }
      }
    })()
    return () => {
      ok = false
    }
  }, [lead, eventId, period, qYear, qNum])

  const { asc, desc, noPart } = useMemo(
    () => (data ? splitRanking(data.ranking) : { asc: [], desc: [], noPart: [] }),
    [data],
  )

  if (!lead) {
    return (
      <div className="text-muted-foreground px-4 py-6 text-sm md:px-6">
        Chỉ lãnh đạo/điều hành CLB mới xem bảng xếp hạng và thống kê điểm
        danh. Liên hệ BCH nếu bạn cần quyền.
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="px-4 py-6 md:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-40" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  if (err) {
    return (
      <div className="text-destructive px-4 py-4 text-sm md:px-6" role="alert">
        {err}
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="flex flex-col gap-5 py-4 md:gap-6 md:py-6">
      <div className="px-4 md:px-6">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Xếp hạng tham gia
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Mỗi bảng chỉ hiện <strong>tổng điểm</strong> (khi đã tham gia ít nhất một
          sự kiện trong phạm vi lọc). Cột thứ ba:{' '}
          <strong>chưa tham gia sự kiện nào</strong> — khác với trường hợp vẫn
          tham gia nhưng tổng điểm bằng 0.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Phạm vi: {data.scope.description}
          {data.scope.dateFrom && data.scope.dateToExclusive && (
            <span>
              {' '}
              (
              {new Date(data.scope.dateFrom).toLocaleDateString('vi-VN')}
              {' — '}
              {new Date(
                data.scope.dateToExclusive,
              ).toLocaleDateString('vi-VN')}{' '}
              ngoài trừ mốc cuối)
            </span>
          )}{' '}
          · Cập nhật{' '}
          {new Date(data.generatedAt).toLocaleString('vi-VN')}
        </p>
      </div>

      <div className="bg-muted/30 flex flex-col gap-3 rounded-lg border border-border/50 px-4 py-3 md:mx-6 md:px-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Lọc dữ liệu
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div className="w-full min-w-0 sm:max-w-sm">
            <p className="text-foreground/90 mb-1 text-sm font-medium">
              Sự kiện (tùy chọn)
            </p>
            <Select
              value={eventId || 'all'}
              onValueChange={(v) => setEventId(v === 'all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Theo năm / quý / toàn bộ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả — theo thời gian bên dưới</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!eventId && (
            <>
              <div className="w-full min-w-0 sm:max-w-xs">
                <p className="text-foreground/90 mb-1 text-sm font-medium">
                  Thời gian
                </p>
                <Select
                  value={period}
                  onValueChange={(v) =>
                    setPeriod(v === 'quarter' ? 'quarter' : 'all')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarter">
                      Theo quý (theo mốc bắt đầu sự kiện)
                    </SelectItem>
                    <SelectItem value="all">Từ đầu đến nay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === 'quarter' && (
                <div className="flex flex-wrap gap-3">
                  <div>
                    <p className="text-foreground/90 mb-1 text-sm font-medium">Năm</p>
                    <Select
                      value={String(qYear)}
                      onValueChange={(v) => setQYear(Number(v))}
                    >
                      <SelectTrigger className="w-[7rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: 10 },
                          (_, i) => new Date().getFullYear() + 1 - i,
                        ).map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-foreground/90 mb-1 text-sm font-medium">Quý</p>
                    <Select
                      value={String(qNum)}
                      onValueChange={(v) =>
                        setQNum(Number(v) as 1 | 2 | 3 | 4)
                      }
                    >
                      <SelectTrigger className="w-[7.5rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Q1 (T1–3)</SelectItem>
                        <SelectItem value="2">Q2 (T4–6)</SelectItem>
                        <SelectItem value="3">Q3 (T7–9)</SelectItem>
                        <SelectItem value="4">Q4 (T10–12)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 px-4 md:px-6 lg:grid-cols-3">
        <MiniScoreTable
          title="Tổng điểm tăng dần"
          description="Từ điểm thấp lên cao. Người đã tham gia ít nhất một sự kiện."
          rows={asc}
          showScore
          emptyHint="Không ai có ít nhất một sự kiện tham gia trong phạm vi này."
        />
        <MiniScoreTable
          title="Tổng điểm giảm dần"
          description="Từ điểm cao xuống thấp (bảng xếp hạng quen thuộc)."
          rows={desc}
          showScore
          emptyHint="Không ai có ít nhất một sự kiện tham gia trong phạm vi này."
        />
        <MiniScoreTable
          title="Chưa tham gia sự kiện nào"
          description="Trong phạm vi lọc, chưa có check-in ở sự kiện nào (khác với tổng điểm 0 dù vẫn tham gia)."
          rows={noPart}
          showScore={false}
          emptyHint="Mọi hội viên đang hoạt động đều đã có ít nhất một sự kiện, hoặc chưa có dữ liệu."
        />
      </div>

      <p className="text-muted-foreground border-border/40 mx-4 max-w-3xl border-t pt-2 text-xs md:mx-6">
        Tổng điểm từ công thức: điểm danh buổi họp, check-in, sự kiện hoàn hảo, và
        các khoản trừ (trễ, v.v.) khi có đăng ký. Chỉ số ở đây tóm lược; bạn
        có thể lọc theo quý, năm, toàn bộ, hoặc một sự kiện ở trên.
      </p>
    </div>
  )
}
