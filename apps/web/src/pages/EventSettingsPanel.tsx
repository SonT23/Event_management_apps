import { useEffect, useState } from 'react'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import type { EventListItem } from '@/types/event'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  createFormDialogClassName,
  ScheduleDatetimeBlock,
} from '@/components/forms/ScheduleDatetimeBlock'

type Mgr = { userId: string; fullName: string | null; email: string | null }

type MemberPickRow = { userId: string; fullName: string; email?: string }

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

type Props = {
  eventId: string
  event: EventListItem
  canManage: boolean
  canAddManagers: boolean
  canDeleteEvent: boolean
  lead: boolean
  isCreator: boolean
  managers: Mgr[]
  onRefresh: () => Promise<void>
  onDeleted: () => void
}

export function EventSettingsPanel({
  eventId,
  event: ev,
  canManage,
  canAddManagers,
  canDeleteEvent,
  lead,
  isCreator,
  managers,
  onRefresh,
  onDeleted,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [title, setTitle] = useState(ev.title)
  const [description, setDescription] = useState(ev.description ?? '')
  const [startAt, setStartAt] = useState(toDatetimeLocal(ev.startAt))
  const [expectedEndAt, setExpectedEndAt] = useState(
    ev.expectedEndAt ? toDatetimeLocal(ev.expectedEndAt) : '',
  )
  const [requiresApproval, setRequiresApproval] = useState(ev.requiresApproval)
  const [defaultCancelMinutes, setDefaultCancelMinutes] = useState(
    ev.defaultCancelMinutes != null ? String(ev.defaultCancelMinutes) : '',
  )
  const [status, setStatus] = useState(ev.status)

  const [deleteBusy, setDeleteBusy] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)

  const [mgrOpen, setMgrOpen] = useState(false)
  const [mgrUserId, setMgrUserId] = useState('')
  const [memberOptions, setMemberOptions] = useState<MemberPickRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [mgrBusy, setMgrBusy] = useState(false)

  useEffect(() => {
    if (!editOpen) {
      return
    }
    setTitle(ev.title)
    setDescription(ev.description ?? '')
    setStartAt(toDatetimeLocal(ev.startAt))
    setExpectedEndAt(ev.expectedEndAt ? toDatetimeLocal(ev.expectedEndAt) : '')
    setRequiresApproval(ev.requiresApproval)
    setDefaultCancelMinutes(
      ev.defaultCancelMinutes != null ? String(ev.defaultCancelMinutes) : '',
    )
    setStatus(ev.status)
  }, [editOpen, ev])

  useEffect(() => {
    if (!mgrOpen || !canAddManagers) {
      return
    }
    let o = true
    ;(async () => {
      setMembersLoading(true)
      try {
        const r = await apiJson<{ items: MemberPickRow[] }>(
          '/members?page=1&pageSize=200',
        )
        if (o) {
          setMemberOptions(r.items)
        }
      } catch {
        if (o) {
          setMemberOptions([])
        }
      } finally {
        if (o) {
          setMembersLoading(false)
        }
      }
    })()
    return () => {
      o = false
    }
  }, [mgrOpen, canAddManagers])

  const managerIds = new Set((ev.managers ?? []).map((m) => m.userId))
  const availableManagers = memberOptions.filter((m) => !managerIds.has(m.userId))

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        startAt: new Date(startAt).toISOString(),
        requiresApproval,
      }
      if (expectedEndAt.trim()) {
        body.expectedEndAt = new Date(expectedEndAt).toISOString()
      } else {
        body.expectedEndAt = null
      }
      if (defaultCancelMinutes.trim()) {
        body.defaultCancelMinutes = Number(defaultCancelMinutes)
      }
      if (lead) {
        body.status = status
      }
      await apiJson(`/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEditOpen(false)
      await onRefresh()
    } catch (er) {
      setErr(formatApiError(er))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!window.confirm('Xóa hẳn sự kiện? Toàn bộ dữ liệu liên quan sẽ bị gỡ.')) {
      return
    }
    setDeleteBusy(true)
    setErr(null)
    try {
      await apiJson(`/events/${eventId}`, { method: 'DELETE' })
      onDeleted()
    } catch (er) {
      setErr(formatApiError(er))
    } finally {
      setDeleteBusy(false)
    }
  }

  async function onCancelEvent() {
    if (!window.confirm('Đánh dấu hủy sự kiện?')) {
      return
    }
    setCancelBusy(true)
    setErr(null)
    try {
      await apiJson(`/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      await onRefresh()
    } catch (er) {
      setErr(formatApiError(er))
    } finally {
      setCancelBusy(false)
    }
  }

  async function addManager() {
    if (!mgrUserId) {
      return
    }
    setMgrBusy(true)
    setErr(null)
    try {
      await apiJson(`/events/${eventId}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mgrUserId }),
      })
      setMgrOpen(false)
      setMgrUserId('')
      await onRefresh()
    } catch (er) {
      setErr(formatApiError(er))
    } finally {
      setMgrBusy(false)
    }
  }

  async function removeManager(userId: string) {
    if (!window.confirm('Gỡ người này khỏi quản lý sự kiện?')) {
      return
    }
    setErr(null)
    try {
      await apiJson(`/events/${eventId}/managers/${userId}`, {
        method: 'DELETE',
      })
      await onRefresh()
    } catch (er) {
      setErr(formatApiError(er))
    }
  }

  const showSettings = canManage || canDeleteEvent || canAddManagers
  if (!showSettings) {
    return null
  }

  const canStatusEdit = lead
  const canCancelStatus =
    (lead || isCreator) && !['ended', 'cancelled'].includes(ev.status)

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">CRUD sự kiện</CardTitle>
        <CardDescription>
          Sửa nội dung, hủy, xóa (theo quyền), và gán quản lý sự kiện (BCH hoặc
          người tạo).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {err && (
          <p className="text-destructive text-sm" role="alert">
            {err}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa thông tin
            </Button>
          )}
          {canDeleteEvent && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onDelete()}
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Đang xóa…' : 'Xóa sự kiện'}
            </Button>
          )}
          {canCancelStatus && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void onCancelEvent()}
              disabled={cancelBusy}
            >
              {cancelBusy ? 'Đang cập nhật…' : 'Hủy sự kiện (trạng thái)'}
            </Button>
          )}
        </div>

        {canAddManagers && (
          <div className="border-border/60 space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Quản lý sự kiện (thêm / gỡ)</p>
            <ul className="space-y-1 text-sm">
              {managers.length === 0 && (
                <li className="text-muted-foreground">Chưa gán quản lý phụ.</li>
              )}
              {managers.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{m.fullName?.trim() || m.email || m.userId}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7"
                    onClick={() => void removeManager(m.userId)}
                  >
                    Gỡ
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setMgrOpen(true)
                  setErr(null)
                }}
              >
                Thêm quản lý
              </Button>
            </div>
          </div>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className={createFormDialogClassName}>
            <form onSubmit={onSaveEdit}>
              <DialogHeader>
                <DialogTitle>Sửa sự kiện</DialogTitle>
                <DialogDescription>
                  Chỉnh sửa thông tin bên dưới rồi lưu để áp dụng.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="es-title">Tiêu đề</Label>
                  <Input
                    id="es-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="es-desc">Mô tả</Label>
                  <Textarea
                    id="es-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <ScheduleDatetimeBlock
                  start={{
                    id: 'es-start',
                    label: 'Bắt đầu',
                    control: (
                      <Input
                        id="es-start"
                        type="datetime-local"
                        className="w-full"
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                        required
                      />
                    ),
                  }}
                  end={{
                    id: 'es-end',
                    label: 'Dự kiến kết thúc',
                    control: (
                      <Input
                        id="es-end"
                        type="datetime-local"
                        className="w-full"
                        value={expectedEndAt}
                        onChange={(e) => setExpectedEndAt(e.target.value)}
                      />
                    ),
                  }}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="es-ap"
                    className="size-4 rounded"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                  />
                  <Label htmlFor="es-ap" className="font-normal">
                    Cần duyệt đăng ký
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="es-can">Số phút tối thiểu trước khi hủy (tuỳ chọn)</Label>
                  <Input
                    id="es-can"
                    type="number"
                    min={0}
                    placeholder="Trống = không cấu hình"
                    value={defaultCancelMinutes}
                    onChange={(e) => setDefaultCancelMinutes(e.target.value)}
                  />
                </div>
                {canStatusEdit && (
                  <div className="space-y-1.5">
                    <Label>Trạng thái (BCH)</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Nháp</SelectItem>
                        <SelectItem value="published">Đã công bố</SelectItem>
                        <SelectItem value="ongoing">Đang diễn ra</SelectItem>
                        <SelectItem value="ended">Đã kết thúc</SelectItem>
                        <SelectItem value="cancelled">Đã hủy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                >
                  Đóng
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Lưu'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={mgrOpen} onOpenChange={setMgrOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm quản lý sự kiện</DialogTitle>
              <DialogDescription>
                Chọn hội viên; họ sẽ có quyền vận hành (duyệt, tiểu ban, v.v.) như
                cấu hình hệ thống.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Thành viên</Label>
              <Select value={mgrUserId} onValueChange={setMgrUserId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={membersLoading ? 'Đang tải…' : 'Chọn người'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableManagers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.fullName} {m.email ? `(${m.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMgrOpen(false)}>
                Hủy
              </Button>
              <Button
                type="button"
                onClick={() => void addManager()}
                disabled={mgrBusy || !mgrUserId}
              >
                {mgrBusy ? 'Đang thêm…' : 'Thêm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
