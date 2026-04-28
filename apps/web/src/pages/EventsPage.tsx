import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { isClubLeadership, roleCodesFromUser } from '@/lib/roles'
import { eventStatusLabel } from '@/lib/statusLabels'
import type { EventListItem, EventListResponse, EventManagerRef } from '@/types/event'
import { ManagedEventsBlock } from '@/pages/ManagedEventsBlock'
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
  addDurationDatetimeLocal,
  EVENT_DEFAULT_END_OFFSET_MS,
} from '@/lib/datetimeLocal'
import { ScheduleDatetimeBlock, createFormDialogClassName } from '@/components/forms/ScheduleDatetimeBlock'

const createSchema = z.object({
  title: z.string().min(1, 'Bắt buộc'),
  description: z.string().optional(),
  startAt: z.string().min(1, 'Chọn thời điểm bắt đầu'),
  expectedEndAt: z.string().optional(),
  requiresApproval: z.boolean().optional(),
})

type CreateForm = z.infer<typeof createSchema>

function isSeedEventTitle(title: string) {
  return title.trimStart().startsWith('[Seed]')
}

function managerDisplayName(m: EventManagerRef) {
  return m.fullName?.trim() || m.email || m.userId
}

type MemberPickRow = {
  userId: string
  fullName: string
  email?: string
}

const statuses = [
  { v: '', label: 'Mọi trạng thái' },
  { v: 'draft', label: 'Nháp' },
  { v: 'published', label: 'Đã công bố' },
  { v: 'ongoing', label: 'Đang diễn ra' },
  { v: 'ended', label: 'Đã kết thúc' },
  { v: 'cancelled', label: 'Đã hủy' },
]

export function EventsPage() {
  const { user } = useAuth()
  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false
  const [status, setStatus] = useState('')
  const [data, setData] = useState<EventListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [managerIds, setManagerIds] = useState<string[]>([])
  const [memberOptions, setMemberOptions] = useState<MemberPickRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      title: '',
      description: '',
      startAt: '',
      expectedEndAt: '',
      requiresApproval: true,
    },
  })
  const startAtRegister = form.register('startAt')

  const load = useCallback(async () => {
    setErr(null)
    const q = new URLSearchParams()
    if (status) {
      q.set('status', status)
    }
    q.set('page', '1')
    q.set('pageSize', '50')
    const r = await apiJson<EventListResponse>(`/events?${q.toString()}`)
    setData(r.items)
    setTotal(r.total)
  }, [status])

  useEffect(() => {
    let ok = true
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (e) {
        if (ok) {
          setErr(formatApiError(e))
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
  }, [load])

  useEffect(() => {
    if (!open || !lead) {
      return
    }
    let cancelled = false
    ;(async () => {
      setMembersLoading(true)
      setMemberQuery('')
      try {
        const r = await apiJson<{
          items: MemberPickRow[]
        }>('/members?page=1&pageSize=200')
        if (!cancelled) {
          setMemberOptions(r.items)
        }
      } catch {
        if (!cancelled) {
          setMemberOptions([])
        }
      } finally {
        if (!cancelled) {
          setMembersLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, lead])

  async function onCreate(v: CreateForm) {
    setSaving(true)
    setCreateErr(null)
    try {
      const body: Record<string, unknown> = {
        title: v.title,
        startAt: new Date(v.startAt).toISOString(),
        requiresApproval: v.requiresApproval !== false,
      }
      if (v.description) {
        body.description = v.description
      }
      if (v.expectedEndAt) {
        body.expectedEndAt = new Date(v.expectedEndAt).toISOString()
      }
      if (managerIds.length) {
        body.managerUserIds = managerIds
      }
      await apiJson('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setOpen(false)
      setManagerIds([])
      form.reset()
      await load()
    } catch (e) {
      setCreateErr(formatApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
        <div className="max-w-xl">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Sự kiện
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Tổng{' '}
            <span className="text-foreground font-medium">{total}</span> sự kiện
            {total !== data.length
              ? ` — hiển thị tối đa ${data.length} mục theo bộ lọc`
              : ' — đã tải đủ theo bộ lọc'}
            .
            {!lead && (
              <span>
                {' '}
                Bạn thấy sự kiện công bố; bản nháp của bạn nếu là người tạo.
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          <Select
            value={status || 'all'}
            onValueChange={(v) => setStatus(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Lọc" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem
                  key={s.v || 'all'}
                  value={s.v || 'all'}
                >
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lead && (
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v)
                if (!v) {
                  setCreateErr(null)
                  setManagerIds([])
                  setMemberQuery('')
                }
              }}
            >
              <DialogTrigger asChild>
                <Button type="button">Tạo sự kiện</Button>
              </DialogTrigger>
              <DialogContent className={createFormDialogClassName}>
                <DialogHeader>
                  <DialogTitle>Sự kiện mới</DialogTitle>
                  <DialogDescription>
                    Tạo ở trạng thái nháp, sau đó công bố khi sẵn sàng.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={form.handleSubmit(onCreate)}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="t">Tiêu đề</Label>
                    <Input id="t" {...form.register('title')} />
                    {form.formState.errors.title && (
                      <p className="text-destructive text-xs">
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="d">Mô tả</Label>
                    <Textarea id="d" rows={3} {...form.register('description')} />
                  </div>
                  <ScheduleDatetimeBlock
                    hint={
                      <span>
                        Chọn thời điểm bắt đầu.{' '}
                        <span className="text-foreground font-medium">
                          Dự kiến kết thúc
                        </span>{' '}
                        tự gợi ý cách bắt đầu 2 giờ (có thể chỉnh).
                      </span>
                    }
                    start={{
                      id: 's',
                      label: 'Bắt đầu',
                      control: (
                        <Input
                          id="s"
                          type="datetime-local"
                          className="w-full"
                          {...startAtRegister}
                          onChange={(e) => {
                            startAtRegister.onChange(e)
                            const v = e.target.value
                            if (v) {
                              form.setValue(
                                'expectedEndAt',
                                addDurationDatetimeLocal(
                                  v,
                                  EVENT_DEFAULT_END_OFFSET_MS,
                                ),
                                {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                },
                              )
                            } else {
                              form.setValue('expectedEndAt', '', {
                                shouldDirty: true,
                              })
                            }
                          }}
                        />
                      ),
                    }}
                    end={{
                      id: 'e',
                      label: 'Dự kiến kết thúc',
                      control: (
                        <Input
                          id="e"
                          type="datetime-local"
                          className="w-full"
                          {...form.register('expectedEndAt')}
                        />
                      ),
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ap"
                      className="size-4 rounded"
                      {...form.register('requiresApproval')}
                    />
                    <Label htmlFor="ap" className="font-normal">
                      Cần duyệt đăng ký
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-foreground">Quản lý sự kiện</Label>
                      <p className="text-muted-foreground text-xs">
                        Tùy chọn — chọn từ hội viên. Có thể chỉnh lại ở trang chi
                        tiết sự kiện.
                      </p>
                    </div>
                    <Input
                      type="search"
                      placeholder="Tìm theo tên hoặc email…"
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      className="text-sm"
                      disabled={membersLoading}
                    />
                    <div className="border-input bg-background max-h-44 overflow-y-auto rounded-md border p-2 text-sm">
                      {membersLoading && (
                        <p className="text-muted-foreground p-1 text-xs">
                          Đang tải danh sách…
                        </p>
                      )}
                      {!membersLoading && memberOptions.length === 0 && (
                        <p className="text-muted-foreground p-1 text-xs">
                          Không tải được danh sách hội viên.
                        </p>
                      )}
                      {!membersLoading &&
                        memberOptions
                          .filter((m) => {
                            const q = memberQuery.trim().toLowerCase()
                            if (!q) {
                              return true
                            }
                            return (
                              m.fullName.toLowerCase().includes(q) ||
                              (m.email?.toLowerCase().includes(q) ?? false) ||
                              m.userId.includes(q)
                            )
                          })
                          .map((m) => {
                            const on = managerIds.includes(m.userId)
                            return (
                              <label
                                key={m.userId}
                                className="hover:bg-muted/60 flex cursor-pointer items-start gap-2 rounded px-1 py-1.5"
                              >
                                <input
                                  type="checkbox"
                                  className="border-input mt-0.5 size-4 shrink-0 rounded"
                                  checked={on}
                                  onChange={() => {
                                    setManagerIds((prev) =>
                                      prev.includes(m.userId)
                                        ? prev.filter((x) => x !== m.userId)
                                        : [...prev, m.userId],
                                    )
                                  }}
                                />
                                <span className="min-w-0 leading-tight">
                                  <span className="font-medium">
                                    {m.fullName}
                                  </span>
                                  {m.email && (
                                    <span className="text-muted-foreground block text-xs">
                                      {m.email}
                                    </span>
                                  )}
                                </span>
                              </label>
                            )
                          })}
                    </div>
                    {managerIds.length > 0 && (
                      <p className="text-muted-foreground text-xs">
                        Đã chọn {managerIds.length} người
                      </p>
                    )}
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
          )}
        </div>
      </div>

      <ManagedEventsBlock
        className="px-4 lg:px-6"
        showWhenEmpty={false}
      />

      {loading && (
        <div className="grid gap-3 px-4 md:grid-cols-2 lg:px-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}
      {!loading && err && !data.length && (
        <p className="text-destructive px-4 text-sm lg:px-6" role="alert">
          {err}
        </p>
      )}

      <div className="grid gap-3 px-4 *:data-[slot=card]:border-border/60 md:grid-cols-2 lg:px-6">
        {data.map((ev) => (
          <Link key={ev.id} to={`/app/events/${ev.id}`}>
            <Card className="bg-card/80 h-full border shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-base leading-snug">
                    {ev.title}
                  </CardTitle>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {isSeedEventTitle(ev.title) && (
                      <Badge variant="outline" className="text-xs">
                        Dữ liệu thử
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {eventStatusLabel(ev.status)}
                    </Badge>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  {new Date(ev.startAt).toLocaleString('vi-VN')}
                  {ev.requiresApproval ? ' · cần duyệt đăng ký' : ' · đăng ký tự duyệt'}
                </p>
              </CardHeader>
              <CardContent>
                {ev.description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {ev.description}
                  </p>
                )}
                {ev.creatorEmail && (
                  <p className="text-muted-foreground/80 mt-1 text-xs">
                    Người tạo: {ev.creatorEmail}
                  </p>
                )}
                {(ev.managers?.length ?? 0) > 0 && (
                  <p className="text-foreground/90 mt-2 text-xs">
                    <span className="text-muted-foreground">Quản lý sự kiện: </span>
                    {(ev.managers ?? []).map(managerDisplayName).join(' · ')}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
