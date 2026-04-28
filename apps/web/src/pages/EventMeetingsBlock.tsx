import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import type { EventMeetingItem } from '@/types/meeting'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  toDatetimeLocalValue,
  addDurationDatetimeLocal,
  MEETING_DEFAULT_END_OFFSET_MS,
} from '@/lib/datetimeLocal'
import {
  createFormDialogClassName,
  ScheduleDatetimeBlock,
} from '@/components/forms/ScheduleDatetimeBlock'

const createSchema = z.object({
  title: z.string().min(1, 'Bắt buộc'),
  reason: z.string().optional(),
  startAt: z.string().min(1, 'Chọn thời gian'),
  endAt: z.string().min(1, 'Chọn thời gian'),
})

type CreateMeetingForm = z.infer<typeof createSchema>

function meetingTypeLabel(t: string) {
  if (t === 'in_event') {
    return 'Trong sự kiện'
  }
  return 'Trước sự kiện'
}

function meetingListStatusLabel(m: EventMeetingItem) {
  if (m.status === 'cancelled') {
    return 'Đã hủy'
  }
  const tEnd = m.officialEndAt ?? m.actualEndAt ?? m.endAt
  if (tEnd && Date.now() >= new Date(tEnd).getTime()) {
    return 'Đã kết thúc'
  }
  return 'Đang lên lịch'
}

type Props = {
  eventId: string
  /** Bắt đầu sự kiện (ISO) — buổi họp phải hoàn toàn trước mốc này */
  eventStartAt: string
  canManage: boolean
  /** BCH hoặc quản lý sự kiện — mở kiosk điểm danh buổi họp */
  canScanAttendance: boolean
  /** Chỉ cho tạo/sửa khi sự kiện còn hoạt động */
  eventStatus: string
}

const SCAN_WINDOW_MS = 30 * 60 * 1_000
const FUTURE_SKEW_MS = 2_000

function validateMeetingBeforeEventStart(
  v: { startAt: string; endAt: string },
  eventStartAt: string,
): string | null {
  const evS = new Date(eventStartAt)
  if (Number.isNaN(evS.getTime())) {
    return null
  }
  const s = new Date(v.startAt)
  const e = new Date(v.endAt)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return 'Thời gian không hợp lệ'
  }
  const pastThreshold = Date.now() - FUTURE_SKEW_MS
  if (s.getTime() < pastThreshold || e.getTime() < pastThreshold) {
    return 'Thời điểm bắt đầu và dự kiến kết thúc phải sau thời điểm hiện tại'
  }
  if (e <= s) {
    return 'Dự kiến kết thúc phải sau bắt đầu'
  }
  const scanCloseT = s.getTime() + SCAN_WINDOW_MS
  if (e.getTime() <= scanCloseT) {
    return 'Dự kiến kết thúc phải sau 30 phút kể từ bắt đầu (sau thời điểm đóng quét điểm danh)'
  }
  if (e.getTime() >= evS.getTime() || s.getTime() >= evS.getTime()) {
    return 'Bắt đầu và dự kiến kết thúc phải nằm trước thời điểm bắt đầu sự kiện'
  }
  return null
}

export function EventMeetingsBlock({
  eventId,
  eventStartAt,
  canManage,
  canScanAttendance,
  eventStatus,
}: Props) {
  const [list, setList] = useState<EventMeetingItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Tăng mỗi lần mở hộp thoại để làm mới mốc “từ giờ” cho trường datetime. */
  const [scheduleMinTick, setScheduleMinTick] = useState(0)
  const form = useForm<CreateMeetingForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: '',
      reason: '',
      startAt: '',
      endAt: '',
    },
  })
  const startAtRegister = form.register('startAt')

  const openForOps =
    eventStatus === 'draft' ||
    eventStatus === 'published' ||
    eventStatus === 'ongoing'

  /** Giới hạn chọn giờ trên form (trước mốc bắt đầu sự kiện) */
  const eventStartInputMax = useMemo(() => {
    const d = new Date(eventStartAt)
    if (Number.isNaN(d.getTime())) {
      return undefined
    }
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [eventStartAt])

  const nowInputMin = useMemo(
    () => toDatetimeLocalValue(new Date()),
    [createOpen, scheduleMinTick],
  )

  const startWatch = form.watch('startAt')
  const scanWindowHint = useMemo(() => {
    if (!startWatch) {
      return null
    }
    const t = new Date(startWatch)
    if (Number.isNaN(t.getTime())) {
      return null
    }
    const close = new Date(t.getTime() + SCAN_WINDOW_MS)
    return { open: t, close }
  }, [startWatch])

  const endInputMin = useMemo(() => {
    const n = new Date(nowInputMin)
    const nT = !Number.isNaN(n.getTime()) && nowInputMin ? n.getTime() : 0
    if (!startWatch) {
      return nowInputMin || undefined
    }
    const s = new Date(startWatch)
    if (Number.isNaN(s.getTime())) {
      return nowInputMin || undefined
    }
    const afterScan = s.getTime() + SCAN_WINDOW_MS + 60_000
    const t = Math.max(afterScan, nT)
    return toDatetimeLocalValue(new Date(t))
  }, [startWatch, nowInputMin])

  const load = useCallback(async () => {
    if (!eventId) {
      return
    }
    setErr(null)
    try {
      const rows = await apiJson<EventMeetingItem[]>(
        `/events/${eventId}/meetings`,
      )
      setList(rows)
    } catch (e) {
      setErr(formatApiError(e))
      setList([])
    }
  }, [eventId])

  useEffect(() => {
    let o = true
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } finally {
        if (o) {
          setLoading(false)
        }
      }
    })()
    return () => {
      o = false
    }
  }, [load])

  async function onCreate(v: CreateMeetingForm) {
    setSaving(true)
    setCreateErr(null)
    const windowErr = validateMeetingBeforeEventStart(v, eventStartAt)
    if (windowErr) {
      setCreateErr(windowErr)
      setSaving(false)
      return
    }
    try {
      const body: Record<string, unknown> = {
        title: v.title,
        meetingType: 'pre_event',
        startAt: new Date(v.startAt).toISOString(),
        endAt: new Date(v.endAt).toISOString(),
      }
      if (v.reason?.trim()) {
        body.reason = v.reason.trim()
      }
      await apiJson(`/events/${eventId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setCreateOpen(false)
      form.reset()
      await load()
    } catch (e) {
      setCreateErr(formatApiError(e))
    } finally {
      setSaving(false)
    }
  }

  async function doCancel(meetingId: string) {
    if (
      !window.confirm('Hủy buổi họp này? Không thể điểm danh thêm sau khi hủy.')
    ) {
      return
    }
    try {
      await apiJson(`/events/${eventId}/meetings/${meetingId}/cancel`, {
        method: 'POST',
      })
      await load()
    } catch (e) {
      setErr(formatApiError(e))
    }
  }

  async function doEndEarly(meetingId: string) {
    if (
      !window.confirm(
        'Ghi nhận kết thúc buổi họp tại thời điểm hiện tại (trước mốc dự kiến)?',
      )
    ) {
      return
    }
    setErr(null)
    try {
      await apiJson(
        `/events/${eventId}/meetings/${meetingId}/end-early`,
        { method: 'POST' },
      )
      await load()
    } catch (e) {
      setErr(formatApiError(e))
    }
  }

  function canShowEndEarlyButton(m: EventMeetingItem) {
    if (m.status !== 'scheduled' || m.actualEndAt) {
      return false
    }
    const t0 = new Date(m.startAt).getTime()
    const t1 = new Date(m.endAt).getTime()
    const now = Date.now()
    return now >= t0 && now < t1
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Buổi họp</CardTitle>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Ban chủ nhiệm / quản lý sự kiện tạo buổi họp (tổ chức trước thời điểm
            bắt đầu sự kiện); điểm danh cùng mã QR đăng ký sự kiện.
          </p>
        </div>
        {canManage && openForOps && (
          <Dialog
            open={createOpen}
            onOpenChange={(v) => {
              setCreateOpen(v)
              if (v) {
                setScheduleMinTick((t) => t + 1)
                setCreateErr(null)
              } else {
                setCreateErr(null)
                form.reset({ title: '', reason: '', startAt: '', endAt: '' })
              }
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="secondary">
                Thêm buổi họp
              </Button>
            </DialogTrigger>
            <DialogContent className={createFormDialogClassName}>
              <DialogHeader>
                <DialogTitle>Buổi họp mới</DialogTitle>
                <DialogDescription>
                  Tiêu đề, lý do, bắt đầu và mốc dự kiến kết thúc (trước thời điểm
                  sự kiện:{' '}
                  <span className="text-foreground font-medium">
                    {new Date(eventStartAt).toLocaleString('vi-VN')}
                  </span>
                  ). Mở quét điểm danh trùng lúc bắt đầu, đóng quét 30 phút sau.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit(onCreate)}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="mt">Tiêu đề</Label>
                  <Input id="mt" {...form.register('title')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mr">Lý do / nội dung</Label>
                  <Textarea
                    id="mr"
                    rows={3}
                    placeholder="Ví dụ: Phân công lên kịch bản, chốt danh sách…"
                    {...form.register('reason')}
                  />
                </div>
                <ScheduleDatetimeBlock
                  hint={
                    <span>
                      Mốc bắt đầu và dự kiến kết thúc phải sau thời điểm hiện
                      tại, và trước khi sự kiện bắt đầu. Giống tạo sự kiện: chọn
                      bắt đầu rồi tự gợi ý mốc kết thúc (+1 giờ 30 phút, có thể
                      sửa). Quét điểm: 30 phút đầu. Nếu chưa kết sớm, dự kiến là
                      mốc kết thúc chính thức.
                    </span>
                  }
                  start={{
                    id: 'ms',
                    label: 'Bắt đầu',
                    control: (
                      <Input
                        id="ms"
                        type="datetime-local"
                        className="w-full"
                        min={nowInputMin}
                        max={eventStartInputMax}
                        {...startAtRegister}
                        onChange={(e) => {
                          startAtRegister.onChange(e)
                          const v = e.target.value
                          if (v) {
                            form.setValue(
                              'endAt',
                              addDurationDatetimeLocal(
                                v,
                                MEETING_DEFAULT_END_OFFSET_MS,
                              ),
                              {
                                shouldValidate: true,
                                shouldDirty: true,
                              },
                            )
                          } else {
                            form.setValue('endAt', '', { shouldDirty: true })
                          }
                        }}
                      />
                    ),
                  }}
                  end={{
                    id: 'me',
                    label: 'Dự kiến kết thúc',
                    control: (
                      <Input
                        id="me"
                        type="datetime-local"
                        className="w-full"
                        min={endInputMin}
                        max={eventStartInputMax}
                        {...form.register('endAt')}
                      />
                    ),
                  }}
                />
                {scanWindowHint && (
                  <p className="text-muted-foreground text-xs">
                    Điểm danh: mở quét từ{' '}
                    {scanWindowHint.open.toLocaleString('vi-VN')} — đóng quét
                    lúc {scanWindowHint.close.toLocaleString('vi-VN')}
                  </p>
                )}
                {createErr && (
                  <p className="text-destructive text-sm" role="alert">
                    {createErr}
                  </p>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Đang tạo…' : 'Tạo buổi họp'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        )}
        {err && (
          <p className="text-destructive text-sm" role="alert">
            {err}
          </p>
        )}
        {!loading && !err && list && list.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Chưa có buổi họp nào trong sự kiện này.
          </p>
        )}
        {!loading && list && list.length > 0 && (
          <ul className="space-y-3">
            {list.map((m) => (
              <li
                key={m.id}
                className="border-border/80 rounded-lg border p-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    {m.reason && (
                      <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
                        {m.reason}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      {meetingTypeLabel(m.meetingType)} · Bắt đầu{' '}
                      {new Date(m.startAt).toLocaleString('vi-VN')}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Dự kiến kết thúc:{' '}
                      {new Date(m.endAt).toLocaleString('vi-VN')}
                      {m.actualEndAt && (
                        <>
                          {' '}
                          · Kết thúc sớm:{' '}
                          {new Date(m.actualEndAt).toLocaleString('vi-VN')}
                        </>
                      )}
                    </p>
                    {m.scanOpenAt && m.scanCloseAt && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Quét điểm danh:{' '}
                        {new Date(m.scanOpenAt).toLocaleString('vi-VN')} —{' '}
                        {new Date(m.scanCloseAt).toLocaleString('vi-VN')}
                      </p>
                    )}
                    {m.creatorEmail && (
                      <p className="text-muted-foreground/90 mt-0.5 text-xs">
                        Tạo bởi: {m.creatorEmail}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge
                      variant={m.status === 'cancelled' ? 'outline' : 'secondary'}
                    >
                      {meetingListStatusLabel(m)}
                    </Badge>
                    {m.status === 'scheduled' && canScanAttendance && (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to={`/app/booth-meeting/${eventId}/${m.id}`}
                        >
                          Điểm danh (QR)
                        </Link>
                      </Button>
                    )}
                    {canShowEndEarlyButton(m) && canManage && openForOps && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void doEndEarly(m.id)}
                      >
                        Kết thúc buổi
                      </Button>
                    )}
                    {m.status === 'scheduled' && canManage && openForOps && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void doCancel(m.id)}
                      >
                        Hủy buổi
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
