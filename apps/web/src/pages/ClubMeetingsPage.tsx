import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconCalendarEvent, IconSearch, IconUsers } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import {
  isClubLeadership,
  isDeptOrCenterHead,
  roleCodesFromUser,
} from '@/lib/roles'
import type { ClubAbsenceRow, ClubMeetingListItem } from '@/types/clubMeeting'
import type { AuthUser } from '@/types/profile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import {
  createFormDialogClassName,
  ScheduleDatetimeBlock,
} from '@/components/forms/ScheduleDatetimeBlock'
import {
  toDatetimeLocalValue,
  addDurationDatetimeLocal,
  MEETING_DEFAULT_END_OFFSET_MS,
} from '@/lib/datetimeLocal'

const KINDS = [
  { v: 'quarterly', label: 'Họp định kỳ (quý)' },
  { v: 'year_end', label: 'Cuối năm' },
  { v: 'board', label: 'Ban chủ nhiệm' },
  { v: 'general', label: 'Họp thường' },
  { v: 'other', label: 'Khác' },
  { v: 'emergency', label: 'Họp khẩn cấp' },
] as const

const SCOPES = [
  { v: 'all_members', label: 'Toàn bộ hội viên' },
  { v: 'club_leadership', label: 'Ban chủ nhiệm / điều hành' },
  { v: 'dept_heads_only', label: 'Trưởng ban (ban / center)' },
  { v: 'selected_members', label: 'Chọn thành viên cụ thể' },
] as const

const PERIODIC_KINDS = new Set<string>(['quarterly', 'year_end'])

type ViewCategory = 'all' | 'periodic' | 'emergency' | 'personal'
type TimeFilter = 'all' | 'upcoming' | 'ongoing' | 'past'
type StatusFilter = 'all' | 'scheduled' | 'cancelled'
type ScopeFilter =
  | 'all'
  | 'all_members'
  | 'club_leadership'
  | 'dept_heads_only'
  | 'selected_members'
  | 'event_attendees'

function meetingInPersonalScope(
  m: ClubMeetingListItem,
  roleCodes: string[],
) {
  if (m.mandatoryScope === 'all_members') {
    return false
  }
  if (m.mandatoryScope === 'selected_members') {
    return m.imInInviteeList === true
  }
  if (m.mandatoryScope === 'club_leadership') {
    return isClubLeadership(roleCodes)
  }
  if (m.mandatoryScope === 'dept_heads_only') {
    return isDeptOrCenterHead(roleCodes)
  }
  return false
}

function sortMeetingsForDisplay(items: ClubMeetingListItem[]) {
  const now = Date.now()
  return [...items].sort((a, b) => {
    const aDone = a.status === 'cancelled' || new Date(a.endAt).getTime() < now
    const bDone = b.status === 'cancelled' || new Date(b.endAt).getTime() < now
    if (aDone !== bDone) {
      return aDone ? 1 : -1
    }
    const ta = new Date(a.startAt).getTime()
    const tb = new Date(b.startAt).getTime()
    if (!aDone) {
      return ta - tb
    }
    return tb - ta
  })
}

function passesViewCategory(
  m: ClubMeetingListItem,
  view: ViewCategory,
  user: AuthUser | null,
  roleCodes: string[],
) {
  switch (view) {
    case 'all':
      return true
    case 'periodic':
      return PERIODIC_KINDS.has(m.kind)
    case 'emergency':
      return m.kind === 'emergency'
    case 'personal':
      if (!user) {
        return false
      }
      if (m.source === 'event') {
        return false
      }
      return meetingInPersonalScope(m, roleCodes)
    default:
      return true
  }
}

function passesTimeFilter(m: ClubMeetingListItem, tf: TimeFilter) {
  if (tf === 'all') {
    return true
  }
  if (m.status === 'cancelled') {
    return false
  }
  const now = Date.now()
  const s = new Date(m.startAt).getTime()
  const e = new Date(m.endAt).getTime()
  if (tf === 'upcoming') {
    return now < s
  }
  if (tf === 'ongoing') {
    return s <= now && now <= e
  }
  if (tf === 'past') {
    return e < now
  }
  return true
}

function passesStatusFilter(m: ClubMeetingListItem, sf: StatusFilter) {
  if (sf === 'all') {
    return true
  }
  if (sf === 'scheduled') {
    return m.status === 'scheduled'
  }
  if (sf === 'cancelled') {
    return m.status === 'cancelled'
  }
  return true
}

function passesScopeFilter(m: ClubMeetingListItem, sc: ScopeFilter) {
  if (sc === 'all') {
    return true
  }
  if (m.source === 'event') {
    if (sc === 'event_attendees') {
      return m.mandatoryScope === 'event_attendees'
    }
    return false
  }
  if (sc === 'event_attendees') {
    return false
  }
  return m.mandatoryScope === sc
}

function passesSearch(m: ClubMeetingListItem, q: string) {
  const t = q.trim().toLowerCase()
  if (!t) {
    return true
  }
  return (
    m.title.toLowerCase().includes(t) ||
    (m.detail && m.detail.toLowerCase().includes(t)) ||
    (m.eventTitle && m.eventTitle.toLowerCase().includes(t))
  )
}

function kindLabel(k: string) {
  if (k === 'event_in') {
    return 'Trong sự kiện'
  }
  if (k === 'event_pre') {
    return 'Trước sự kiện'
  }
  return KINDS.find((x) => x.v === k)?.label ?? k
}

function meetingPhaseLine(m: ClubMeetingListItem) {
  if (m.status === 'cancelled') {
    return { label: 'Đã hủy', variant: 'secondary' as const }
  }
  const now = Date.now()
  const s = new Date(m.startAt).getTime()
  const e = new Date(m.endAt).getTime()
  if (now < s) {
    return { label: 'Sắp diễn', variant: 'default' as const }
  }
  if (s <= now && now <= e) {
    return { label: 'Đang diễn', variant: 'default' as const }
  }
  return { label: 'Đã kết thúc', variant: 'outline' as const }
}

function MeetingDateBlock({ startAt }: { startAt: string }) {
  const d = new Date(startAt)
  return (
    <div
      className={cn(
        'from-muted/40 to-muted/20 flex w-full min-h-[100px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border bg-gradient-to-b px-3 py-2 sm:min-w-[96px] sm:max-w-[96px]',
      )}
    >
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {d.toLocaleDateString('vi-VN', { weekday: 'short' })}
      </span>
      <span className="text-foreground text-2xl font-semibold tabular-nums leading-none">
        {d.getDate()}
      </span>
      <span className="text-muted-foreground text-center text-xs leading-tight">
        tháng {d.getMonth() + 1}
      </span>
    </div>
  )
}

function scopeLabel(s: string) {
  if (s === 'event_attendees') {
    return 'Theo sự kiện (đăng ký / quản lý)'
  }
  return SCOPES.find((x) => x.v === s)?.label ?? s
}

const createSchema = z
  .object({
    title: z.string().min(1, 'Bắt buộc'),
    detail: z.string().optional(),
    kind: z.enum([
      'quarterly',
      'year_end',
      'board',
      'general',
      'other',
      'emergency',
    ]),
    mandatoryScope: z.enum([
      'all_members',
      'club_leadership',
      'dept_heads_only',
      'selected_members',
    ]),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    invitedUserIds: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      data.mandatoryScope === 'selected_members' &&
      data.invitedUserIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Chọn ít nhất một thành viên',
        path: ['invitedUserIds'],
      })
    }
  })

type CreateForm = z.infer<typeof createSchema>

const absenceSchema = z.object({
  reason: z.string().min(1, 'Ghi lý do'),
})

type AbsenceForm = z.infer<typeof absenceSchema>

export function ClubMeetingsPage() {
  const { user } = useAuth()
  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false
  const [list, setList] = useState<ClubMeetingListItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [absenceOpen, setAbsenceOpen] = useState(false)
  const [absenceTarget, setAbsenceTarget] = useState<ClubMeetingListItem | null>(null)
  const [absenceErr, setAbsenceErr] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [absenceList, setAbsenceList] = useState<ClubAbsenceRow[] | null>(null)
  const [reviewLoad, setReviewLoad] = useState(false)
  const [viewCategory, setViewCategory] = useState<ViewCategory>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [search, setSearch] = useState('')
  const [memberCatalog, setMemberCatalog] = useState<
    { userId: string; fullName: string | null; email?: string }[]
  >([])
  const [memberCatalogLoad, setMemberCatalogLoad] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  const roleCodes = useMemo(
    () => (user ? roleCodesFromUser(user) : []),
    [user],
  )

  const displayed = useMemo(() => {
    if (!list) {
      return []
    }
    return sortMeetingsForDisplay(
      list.filter(
        (m) =>
          passesViewCategory(m, viewCategory, user, roleCodes) &&
          passesTimeFilter(m, timeFilter) &&
          passesStatusFilter(m, statusFilter) &&
          passesScopeFilter(m, scopeFilter) &&
          passesSearch(m, search),
      ),
    )
  }, [
    list,
    user,
    roleCodes,
    viewCategory,
    timeFilter,
    statusFilter,
    scopeFilter,
    search,
  ])

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: '',
      detail: '',
      kind: 'general',
      mandatoryScope: 'all_members',
      startAt: '',
      endAt: '',
      invitedUserIds: [],
    },
  })
  const watchScope = form.watch('mandatoryScope')
  const startAtRegister = form.register('startAt')
  const nowInputMin = useMemo(
    () => toDatetimeLocalValue(new Date()),
    [open],
  )
  const startAtWatch = form.watch('startAt')
  const endInputMin = useMemo(() => {
    if (!startAtWatch) {
      return nowInputMin || undefined
    }
    const s = new Date(startAtWatch)
    if (Number.isNaN(s.getTime())) {
      return nowInputMin || undefined
    }
    return toDatetimeLocalValue(new Date(s.getTime() + 60_000))
  }, [startAtWatch, nowInputMin])

  useEffect(() => {
    if (!open || !lead) {
      return
    }
    let o = true
    setMemberCatalogLoad(true)
    ;(async () => {
      try {
        const res = await apiJson<{
          items: { userId: string; fullName: string | null; email?: string }[]
        }>('/members?page=1&pageSize=500')
        if (o) {
          setMemberCatalog(res.items)
        }
      } catch {
        if (o) {
          setMemberCatalog([])
        }
      } finally {
        if (o) {
          setMemberCatalogLoad(false)
        }
      }
    })()
    return () => {
      o = false
    }
  }, [open, lead])
  const absForm = useForm<AbsenceForm>({
    resolver: zodResolver(absenceSchema),
    defaultValues: { reason: '' },
  })

  const load = useCallback(async () => {
    setErr(null)
    const rows = await apiJson<ClubMeetingListItem[]>('/club-meetings')
    setList(rows)
  }, [])

  useEffect(() => {
    let o = true
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (e) {
        if (o) {
          setErr(formatApiError(e))
          setList([])
        }
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

  async function onCreate(v: CreateForm) {
    setSaving(true)
    setCreateErr(null)
    try {
      const body: Record<string, unknown> = {
        title: v.title,
        detail: v.detail?.trim() || undefined,
        kind: v.kind,
        mandatoryScope: v.mandatoryScope,
        startAt: new Date(v.startAt).toISOString(),
        endAt: new Date(v.endAt).toISOString(),
      }
      if (v.mandatoryScope === 'selected_members' && v.invitedUserIds.length) {
        body.invitedUserIds = v.invitedUserIds
      }
      await apiJson('/club-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setOpen(false)
      form.reset()
      await load()
    } catch (e) {
      setCreateErr(formatApiError(e))
    } finally {
      setSaving(false)
    }
  }

  async function openReview(meetingId: string) {
    setReviewId(meetingId)
    setReviewOpen(true)
    setAbsenceList(null)
    setReviewLoad(true)
    try {
      const rows = await apiJson<ClubAbsenceRow[]>(
        `/club-meetings/${meetingId}/absence`,
      )
      setAbsenceList(rows)
    } catch (e) {
      setErr(formatApiError(e))
    } finally {
      setReviewLoad(false)
    }
  }

  async function decide(
    meetingId: string,
    requestId: string,
    status: 'approved' | 'rejected',
  ) {
    try {
      await apiJson(`/club-meetings/${meetingId}/absence/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await openReview(meetingId)
    } catch (e) {
      setErr(formatApiError(e))
    }
  }

  async function submitAbsence(v: AbsenceForm) {
    if (!absenceTarget) {
      return
    }
    setAbsenceErr(null)
    try {
      await apiJson(`/club-meetings/${absenceTarget.id}/absence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: v.reason }),
      })
      setAbsenceOpen(false)
      absForm.reset()
      setAbsenceTarget(null)
      await load()
    } catch (e) {
      setAbsenceErr(formatApiError(e))
    }
  }

  function canRequestAbsence(m: ClubMeetingListItem) {
    if (m.source === 'event') {
      return false
    }
    if (m.status === 'cancelled') {
      return false
    }
    if (m.myAbsenceRequest) {
      return false
    }
    if (new Date(m.endAt).getTime() < Date.now()) {
      return false
    }
    return true
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
        <div>
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Cuộc họp CLB
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Tổng hợp lịch họp CLB và buổi họp tạo trong từng sự kiện (bạn thấy khi
            đã đăng ký / là quản lý sự kiện). Có thể tạo lịch theo phạm vi mặc định
            hoặc chọn người được mời cụ thể. Mở từng sự kiện để điểm danh/điều
            hành buổi họp tại sự kiện.
          </p>
        </div>
        {lead && (
          <Button type="button" onClick={() => setOpen(true)}>
            Tạo cuộc họp
          </Button>
        )}
      </div>

      {loading && (
        <div className="space-y-2 px-4 lg:px-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {err && !loading && (
        <p className="text-destructive px-4 text-sm lg:px-6" role="alert">
          {err}
        </p>
      )}

      {!loading && !err && list !== null && (
        <div className="space-y-4 px-4 lg:px-6">
          <div className="bg-card space-y-4 rounded-lg border p-3 shadow-sm md:p-4">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Nhóm lịch
              </p>
              <ToggleGroup
                type="single"
                value={viewCategory}
                onValueChange={(v) => v && setViewCategory(v as ViewCategory)}
                className="flex flex-wrap justify-start gap-1"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="all">Tất cả</ToggleGroupItem>
                <ToggleGroupItem value="periodic">Họp định kỳ</ToggleGroupItem>
                <ToggleGroupItem value="emergency">Họp khẩn cấp</ToggleGroupItem>
                <ToggleGroupItem value="personal">Cá nhân (theo vai trò)</ToggleGroupItem>
              </ToggleGroup>
              <p className="text-muted-foreground mt-1.5 text-xs">
                &quot;Cá nhân&quot; gồm lịch CLB (không phải toàn hội) mà bạn
                thuộc phạm vi bắt buộc — hoặc bạn nằm trong danh sách mời khi
                tạo theo thành viên cụ thể. (Lịch trong sự kiện dùng bộ lọc Phạm
                vi: «Theo sự kiện».)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Thời gian</Label>
                <Select
                  value={timeFilter}
                  onValueChange={(v) => setTimeFilter(v as TimeFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="upcoming">Sắp diễn</SelectItem>
                    <SelectItem value="ongoing">Đang diễn</SelectItem>
                    <SelectItem value="past">Đã kết thúc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  Trạng thái lịch
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="scheduled">Còn lịch (chưa hủy)</SelectItem>
                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-muted-foreground text-xs">
                  Phạm vi tham dự
                </Label>
                <Select
                  value={scopeFilter}
                  onValueChange={(v) => setScopeFilter(v as ScopeFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="all_members">Toàn bộ hội viên</SelectItem>
                    <SelectItem value="club_leadership">
                      Ban chủ nhiệm / điều hành
                    </SelectItem>
                    <SelectItem value="dept_heads_only">
                      Trưởng ban (ban / center)
                    </SelectItem>
                    <SelectItem value="selected_members">Chọn thành viên (CLB)</SelectItem>
                    <SelectItem value="event_attendees">Theo sự kiện</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tiêu đề, tên sự kiện hoặc nội dung…"
                className="pl-9"
                aria-label="Tìm cuộc họp"
              />
            </div>
          </div>

          {list.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Chưa có cuộc họp nào. {lead && 'Bạn có thể tạo mới ở nút bên trên.'}
            </p>
          ) : displayed.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Không có cuộc họp nào khớp bộ lọc. Hãy thử đổi nhóm lịch, bộ lọc
              phía trên hoặc xóa từ khóa tìm kiếm.
            </p>
          ) : (
            <div className="grid gap-3">
              {displayed.map((m) => {
                const phase = meetingPhaseLine(m)
                const rowKey = `${m.source ?? 'club'}-${m.id}`
                return (
                  <div
                    key={rowKey}
                    className="bg-card flex min-h-[128px] flex-col gap-3 rounded-lg border p-3 shadow-sm sm:flex-row sm:items-stretch sm:gap-4 sm:p-4"
                  >
                    <MeetingDateBlock startAt={m.startAt} />
                    <div className="min-w-0 flex-1 space-y-2 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <IconCalendarEvent className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                          <h3 className="text-foreground text-base font-semibold leading-snug">
                            {m.title}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {m.source === 'event' && (
                            <Badge variant="outline">Họp trong sự kiện</Badge>
                          )}
                          <Badge variant="secondary">{kindLabel(m.kind)}</Badge>
                          <Badge variant={phase.variant}>{phase.label}</Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {new Date(m.startAt).toLocaleString('vi-VN')} —{' '}
                        {new Date(m.endAt).toLocaleString('vi-VN')}
                        {m.creatorName || m.creatorEmail ? (
                          <span>
                            {' '}
                            · Người tạo: {m.creatorName || m.creatorEmail}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                        <IconUsers className="mt-0.5 size-3.5 shrink-0" />
                        <span>Tham dự: {scopeLabel(m.mandatoryScope)}</span>
                        {m.mandatoryScope === 'selected_members' &&
                          typeof m.inviteeCount === 'number' && (
                            <span> · {m.inviteeCount} người được mời</span>
                          )}
                      </p>
                      {m.source === 'event' && m.eventId && m.eventTitle && (
                        <p className="text-foreground/90 text-xs">
                          Sự kiện: {m.eventTitle}
                        </p>
                      )}
                      {m.source === 'event' && m.eventId && (
                        <Button asChild type="button" variant="link" className="h-auto px-0 py-0" size="sm">
                          <Link to={`/app/events/${m.eventId}`}>
                            Mở trang sự kiện (điểm danh, quản lý)
                          </Link>
                        </Button>
                      )}
                      {m.detail && (
                        <p className="text-foreground/90 whitespace-pre-wrap">{m.detail}</p>
                      )}
                      {m.myAbsenceRequest && (
                        <p className="text-muted-foreground text-xs">
                          Xin vắng: {m.myAbsenceRequest.status} (gửi lúc{' '}
                          {new Date(m.myAbsenceRequest.createdAt).toLocaleString('vi-VN')})
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {canRequestAbsence(m) && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAbsenceTarget(m)
                              setAbsenceOpen(true)
                              setAbsenceErr(null)
                            }}
                          >
                            Xin vắng
                          </Button>
                        )}
                        {lead && m.status !== 'cancelled' && m.source !== 'event' && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void openReview(m.id)}
                            >
                              Đơn vắng
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    'Hủy cuộc họp này? Các xin vắng vẫn lưu trong hệ thống.',
                                  )
                                ) {
                                  return
                                }
                                try {
                                  await apiJson(`/club-meetings/${m.id}/cancel`, {
                                    method: 'POST',
                                  })
                                  await load()
                                } catch (e) {
                                  setErr(formatApiError(e))
                                }
                              }}
                            >
                              Hủy lịch
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={createFormDialogClassName}>
          <DialogHeader>
            <DialogTitle>Cuộc họp mới</DialogTitle>
            <DialogDescription>Chỉ ban lãnh đạo/điều hành tạo được.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ct">Tiêu đề</Label>
              <Input id="ct" {...form.register('title')} />
            </div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select
                value={form.watch('kind')}
                onValueChange={(v) =>
                  form.setValue('kind', v as CreateForm['kind'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.v} value={k.v}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phạm vi bắt buộc tham dự (theo mục đích nội dung)</Label>
              <Select
                value={form.watch('mandatoryScope')}
                onValueChange={(v) => {
                  const sc = v as CreateForm['mandatoryScope']
                  form.setValue('mandatoryScope', sc)
                  if (sc !== 'selected_members') {
                    form.setValue('invitedUserIds', [])
                  }
                  setMemberSearch('')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s.v} value={s.v}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {watchScope === 'selected_members' && (
              <div className="space-y-2">
                <Label>Thành viên được mời</Label>
                <Input
                  placeholder="Lọc theo tên hoặc email…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                  {memberCatalogLoad ? (
                    <p className="text-muted-foreground text-xs">Đang tải danh sách…</p>
                  ) : memberCatalog.length === 0 ? (
                    <p className="text-muted-foreground text-xs">Không tải được danh sách hội viên.</p>
                  ) : (
                    memberCatalog
                      .filter((x) => {
                        const t = memberSearch.trim().toLowerCase()
                        if (!t) {
                          return true
                        }
                        return (
                          (x.fullName && x.fullName.toLowerCase().includes(t)) ||
                          (x.email && x.email.toLowerCase().includes(t))
                        )
                      })
                      .map((mem) => {
                        const inv = form.watch('invitedUserIds') ?? []
                        const checked = inv.includes(mem.userId)
                        return (
                          <label
                            key={mem.userId}
                            className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded px-1 py-0.5"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() => {
                                const set = new Set(inv)
                                if (set.has(mem.userId)) {
                                  set.delete(mem.userId)
                                } else {
                                  set.add(mem.userId)
                                }
                                form.setValue('invitedUserIds', [...set], {
                                  shouldValidate: true,
                                })
                              }}
                            />
                            <span>
                              {mem.fullName || '—'}
                              {mem.email ? ` · ${mem.email}` : null}
                            </span>
                          </label>
                        )
                      })
                  )}
                </div>
                {form.formState.errors.invitedUserIds?.message && (
                  <p className="text-destructive text-xs" role="alert">
                    {form.formState.errors.invitedUserIds.message}
                  </p>
                )}
              </div>
            )}
            <ScheduleDatetimeBlock
              hint={
                <span>
                  Giống tạo sự kiện: chọn{' '}
                  <span className="text-foreground font-medium">Bắt đầu</span>
                  , hệ thống gợi ý{' '}
                  <span className="text-foreground font-medium">Dự kiến kết thúc</span>{' '}
                  bằng bắt đầu + 1 giờ 30 phút (có thể chỉnh tay).
                </span>
              }
              start={{
                id: 'cs',
                label: 'Bắt đầu',
                control: (
                  <Input
                    id="cs"
                    type="datetime-local"
                    className="w-full"
                    min={nowInputMin}
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
                id: 'ce',
                label: 'Dự kiến kết thúc',
                control: (
                  <Input
                    id="ce"
                    type="datetime-local"
                    className="w-full"
                    min={endInputMin}
                    {...form.register('endAt')}
                  />
                ),
              }}
            />
            <div className="space-y-1.5">
              <Label htmlFor="cd">Nội dung / ghi chú</Label>
              <Textarea id="cd" rows={3} {...form.register('detail')} />
            </div>
            {createErr && (
              <p className="text-destructive text-sm" role="alert">
                {createErr}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? 'Đang tạo…' : 'Tạo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={absenceOpen} onOpenChange={setAbsenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xin vắng</DialogTitle>
            <DialogDescription>
              {absenceTarget?.title} — gửi BCH/điều hành xem xét.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={absForm.handleSubmit(submitAbsence)}
            className="space-y-2"
          >
            <Textarea
              rows={3}
              placeholder="Lý do (bắt buộc)"
              {...absForm.register('reason')}
            />
            {absenceErr && (
              <p className="text-destructive text-sm">{absenceErr}</p>
            )}
            <DialogFooter>
              <Button type="submit">Gửi</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Đơn xin vắng</SheetTitle>
            <SheetDescription>Danh sách theo từng cuộc họp.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 max-h-[70dvh] space-y-3 overflow-y-auto pr-1">
            {reviewLoad && <Skeleton className="h-20" />}
            {!reviewLoad && absenceList?.map((a, i) => (
              <div key={a.id}>
                {i > 0 && <Separator className="my-2" />}
                <p className="text-sm font-medium">
                  {a.fullName || a.email || a.userId}
                </p>
                <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                  {a.reason}
                </p>
                <p className="text-muted-foreground text-xs">Trạng thái: {a.status}</p>
                {a.status === 'pending' && reviewId && (
                  <div className="mt-1 flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void decide(reviewId, a.id, 'approved')}
                    >
                      Duyệt
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void decide(reviewId, a.id, 'rejected')}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!reviewLoad && !absenceList?.length && (
              <p className="text-muted-foreground text-sm">Chưa có đơn.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
