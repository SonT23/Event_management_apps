import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import type { SubcommitteeRow } from '@/types/event'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'

type ApprovedLite = { userId: string; fullName: string | null; email?: string }

type Props = {
  eventId: string
  canManage: boolean
  approvedRegs: ApprovedLite[]
}

function capLabel(max: number | null, count: number) {
  if (max == null) {
    return `${count} (không giới hạn)`
  }
  return `${count} / ${max}`
}

/** DB: mỗi thành viên chỉ thuộc tối đa một tiểu ban / sự kiện (trigger SQL). */
function inOtherSubcommittee(
  all: SubcommitteeRow[],
  currentId: string,
  userId: string,
) {
  return all.some(
    (sub) =>
      sub.id !== currentId &&
      sub.members.some((m) => m.userId === userId),
  )
}

export function EventSubcommitteesBlock({
  eventId,
  canManage,
  approvedRegs,
}: Props) {
  const [list, setList] = useState<SubcommitteeRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [cName, setCName] = useState('')
  const [cCode, setCCode] = useState('')
  const [cMax, setCMax] = useState('')
  const [cBusy, setCBusy] = useState(false)

  const [editSub, setEditSub] = useState<SubcommitteeRow | null>(null)
  const [eName, setEName] = useState('')
  const [eCode, setECode] = useState('')
  const [eMax, setEMax] = useState('')
  const [eUnlimited, setEUnlimited] = useState(false)
  const [eBusy, setEBusy] = useState(false)

  const [addFor, setAddFor] = useState<SubcommitteeRow | null>(null)
  const [addUserId, setAddUserId] = useState('')
  const [aBusy, setABusy] = useState(false)

  const load = useCallback(async () => {
    if (!eventId) {
      return
    }
    setLoadErr(null)
    try {
      const rows = await apiJson<SubcommitteeRow[]>(
        `/events/${eventId}/subcommittees`,
      )
      setList(rows)
    } catch (e) {
      setList(null)
      setLoadErr(formatApiError(e))
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setCBusy(true)
    setErr(null)
    try {
      const body: Record<string, unknown> = { name: cName.trim() }
      if (cCode.trim()) {
        body.code = cCode.trim()
      }
      if (cMax.trim()) {
        body.maxMembers = Number(cMax)
      }
      await apiJson(`/events/${eventId}/subcommittees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setCreateOpen(false)
      setCName('')
      setCCode('')
      setCMax('')
      await load()
    } catch (er) {
      setErr(formatApiError(er))
    } finally {
      setCBusy(false)
    }
  }

  function openEdit(s: SubcommitteeRow) {
    setEditSub(s)
    setEName(s.name)
    setECode(s.code ?? '')
    setEMax(s.maxMembers != null ? String(s.maxMembers) : '')
    setEUnlimited(s.maxMembers == null)
    setErr(null)
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editSub) {
      return
    }
    setEBusy(true)
    setErr(null)
    try {
      const body: Record<string, unknown> = {
        name: eName.trim(),
        code: eCode.trim() || null,
      }
      if (eUnlimited) {
        body.clearMaxMembers = true
      } else {
        if (!eMax.trim()) {
          setErr('Nhập số tối đa hoặc chọn không giới hạn')
          setEBusy(false)
          return
        }
        body.maxMembers = Number(eMax)
      }
      await apiJson(`/events/${eventId}/subcommittees/${editSub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEditSub(null)
      await load()
    } catch (er) {
      setErr(formatApiError(er))
    } finally {
      setEBusy(false)
    }
  }

  async function removeSub(s: SubcommitteeRow) {
    if (!window.confirm(`Xóa tiểu ban «${s.name}»?`)) {
      return
    }
    setErr(null)
    try {
      await apiJson(`/events/${eventId}/subcommittees/${s.id}`, {
        method: 'DELETE',
      })
      await load()
    } catch (er) {
      setErr(formatApiError(er))
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!addFor || !addUserId) {
      return
    }
    setABusy(true)
    setErr(null)
    try {
      await apiJson(
        `/events/${eventId}/subcommittees/${addFor.id}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: addUserId }),
        },
      )
      setAddFor(null)
      setAddUserId('')
      await load()
    } catch (er) {
      setErr(formatApiError(er))
    } finally {
      setABusy(false)
    }
  }

  async function removeMember(subId: string, userId: string) {
    setErr(null)
    try {
      await apiJson(
        `/events/${eventId}/subcommittees/${subId}/members/${userId}`,
        { method: 'DELETE' },
      )
      await load()
    } catch (er) {
      setErr(formatApiError(er))
    }
  }

  if (loadErr) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Tiểu ban: {loadErr}
      </p>
    )
  }
  if (list === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-foreground text-base font-semibold">
            Tiểu ban
          </h3>
          <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">
            Mỗi sự kiện có danh sách tiểu ban riêng (mặc định vài ban khi tạo sự
            kiện mới). Một thành viên chỉ gán vào tối đa một tiểu ban trong cùng
            sự kiện. Chỉ BCH / quản lý sự kiện chỉnh sửa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load()}
          >
            Làm mới
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setErr(null)
                setCreateOpen(true)
              }}
            >
              Thêm tiểu ban
            </Button>
          )}
        </div>
      </div>

      {err && (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => {
          const pick = approvedRegs.filter(
            (r) =>
              !s.members.some((m) => m.userId === r.userId) &&
              !inOtherSubcommittee(list, s.id, r.userId),
          )
          return (
            <Card key={s.id} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-medium">
                      {s.name}
                    </CardTitle>
                    {s.code && (
                      <p className="text-muted-foreground text-xs">
                        Mã: {s.code}
                      </p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {capLabel(s.maxMembers, s.memberCount)}
                  </span>
                </div>
                {canManage && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openEdit(s)}
                    >
                      Sửa
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAddFor(s)
                        setAddUserId('')
                        setErr(null)
                      }}
                    >
                      Thêm thành viên
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 text-xs"
                      onClick={() => void removeSub(s)}
                    >
                      Xóa ban
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0 text-sm">
                {s.members.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Chưa có thành viên.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {s.members.map((m) => (
                      <li
                        key={m.id}
                        className="border-border/50 flex items-center justify-between gap-2 border-b border-dashed py-0.5 last:border-0"
                      >
                        <span className="min-w-0 truncate">
                          {m.fullName?.trim() || m.email || m.userId}
                        </span>
                        {canManage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive h-6 shrink-0 text-xs"
                            onClick={() => void removeMember(s.id, m.userId)}
                          >
                            Rời
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && pick.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {pick.length} thành viên đã duyệt chưa gán — dùng &quot;Thêm
                    thành viên&quot;.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {list.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Chưa có tiểu ban (sự kiện cũ trước khi tính năng này có thể rỗng). Hãy
          thêm bằng nút trên nếu bạn quản lý sự kiện.
        </p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>Tiểu ban mới</DialogTitle>
              <DialogDescription>
                Tên bắt buộc. Giới hạn số người (tùy chọn).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="subc-name">Tên</Label>
                <Input
                  id="subc-name"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subc-code">Mã (tùy chọn)</Label>
                <Input
                  id="subc-code"
                  value={cCode}
                  onChange={(e) => setCCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subc-max">Tối đa số người (để trống = không giới hạn)</Label>
                <Input
                  id="subc-max"
                  type="number"
                  min={1}
                  max={2000}
                  value={cMax}
                  onChange={(e) => setCMax(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={cBusy}>
                {cBusy ? 'Đang tạo…' : 'Tạo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSub} onOpenChange={() => setEditSub(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSaveEdit}>
            <DialogHeader>
              <DialogTitle>Sửa tiểu ban</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="se-name">Tên</Label>
                <Input
                  id="se-name"
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="se-code">Mã</Label>
                <Input
                  id="se-code"
                  value={eCode}
                  onChange={(e) => setECode(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="se-unl"
                  checked={eUnlimited}
                  onChange={(ev) => setEUnlimited(ev.target.checked)}
                  className="size-4 rounded border"
                />
                <Label htmlFor="se-unl" className="text-sm font-normal">
                  Không giới hạn số người
                </Label>
              </div>
              {!eUnlimited && (
                <div className="space-y-1.5">
                  <Label htmlFor="se-max">Tối đa số người</Label>
                  <Input
                    id="se-max"
                    type="number"
                    min={1}
                    max={2000}
                    value={eMax}
                    onChange={(e) => setEMax(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditSub(null)}>
                Đóng
              </Button>
              <Button type="submit" disabled={eBusy}>
                {eBusy ? 'Đang lưu…' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addFor} onOpenChange={() => setAddFor(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={addMember}>
            <DialogHeader>
              <DialogTitle>Thêm vào: {addFor?.name}</DialogTitle>
              <DialogDescription>
                Chọn từ thành viên đã <strong>duyệt</strong> đăng ký sự kiện.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label>Thành viên</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn người" />
                </SelectTrigger>
                <SelectContent>
                  {addFor &&
                    approvedRegs
                      .filter(
                        (r) =>
                          !addFor.members.some((m) => m.userId === r.userId) &&
                          !inOtherSubcommittee(list, addFor.id, r.userId),
                      )
                      .map((r) => (
                        <SelectItem key={r.userId} value={r.userId}>
                          {r.fullName?.trim() || r.email || r.userId}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddFor(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={aBusy || !addUserId}>
                {aBusy ? 'Đang thêm…' : 'Thêm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
