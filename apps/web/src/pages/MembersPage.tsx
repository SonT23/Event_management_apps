import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { isClubLeadership, roleCodesFromUser } from '@/lib/roles'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { MoreHorizontal, Plus } from 'lucide-react'

type Dept = { id: number; code: string; name: string }

type Row = {
  userId: string
  fullName: string
  email?: string
  primaryDepartment: { name: string; code: string } | null
  primaryDepartmentId?: string | null
  membershipStatus: string
  phone: string | null
}

type MemberDetail = Row & {
  gender?: string
  birthDate?: string | null
  major?: string | null
  positionTitle?: string | null
  email?: string
  lastLoginAt?: string | null
  isActive?: boolean
  inactiveReason?: string | null
}

type List = {
  page: number
  pageSize: number
  total: number
  items: Row[]
}

function dateForInput(d: string | null | undefined) {
  if (!d) {
    return ''
  }
  const s = String(d)
  if (s.length >= 10) {
    return s.slice(0, 10)
  }
  return ''
}

export function MembersPage() {
  const { user } = useAuth()
  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false
  const [data, setData] = useState<List | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [departments, setDepartments] = useState<Dept[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [createMsg, setCreateMsg] = useState<string | null>(null)
  const [cBusy, setCBusy] = useState(false)
  const [cEmail, setCEmail] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cFullName, setCFullName] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cMajor, setCMajor] = useState('')
  const [cDept, setCDept] = useState<string>('')
  const [cGender, setCGender] = useState('unspecified')
  const [cBirth, setCBirth] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDetail, setEditDetail] = useState<MemberDetail | null>(null)
  const [eBusy, setEBusy] = useState(false)
  const [eErr, setEErr] = useState<string | null>(null)
  const [eFullName, setEFullName] = useState('')
  const [ePhone, setEPhone] = useState('')
  const [eMajor, setEMajor] = useState('')
  const [ePosition, setEPosition] = useState('')
  const [eDept, setEDept] = useState<string>('')
  const [eGender, setEGender] = useState('unspecified')
  const [eBirth, setEBirth] = useState('')

  const [memOpen, setMemOpen] = useState(false)
  const [memId, setMemId] = useState<string | null>(null)
  const [memName, setMemName] = useState('')
  const [memStatus, setMemStatus] = useState<'active' | 'inactive'>('active')
  const [memReason, setMemReason] = useState('')
  const [mBusy, setMBusy] = useState(false)
  const [memErr, setMemErr] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    if (!lead) {
      return
    }
    setErr(null)
    const q = new URLSearchParams({
      page: '1',
      pageSize: '100',
    })
    if (includeInactive) {
      q.set('includeInactive', '1')
    }
    const r = await apiJson<List>(`/members?${q.toString()}`)
    setData(r)
  }, [lead, includeInactive])

  useEffect(() => {
    let o = true
    ;(async () => {
      try {
        const rows = await apiJson<Dept[]>('/org/departments')
        if (o) {
          setDepartments(rows)
        }
      } catch {
        if (o) {
          setDepartments([])
        }
      }
    })()
    return () => {
      o = false
    }
  }, [])

  useEffect(() => {
    if (!lead) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        await loadList()
      } catch (e) {
        if (!cancelled) {
          setErr(formatApiError(e))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lead, loadList])

  function resetCreateForm() {
    setCEmail('')
    setCPassword('')
    setCFullName('')
    setCPhone('')
    setCMajor('')
    setCDept('')
    setCGender('unspecified')
    setCBirth('')
    setCreateMsg(null)
  }

  async function openEdit(userId: string) {
    setEErr(null)
    setEditingId(userId)
    setEditOpen(true)
    setEditDetail(null)
    setEBusy(true)
    try {
      const d = await apiJson<MemberDetail>(`/members/${userId}`)
      setEditDetail(d)
      setEFullName(d.fullName)
      setEPhone(d.phone ?? '')
      setEMajor(d.major ?? '')
      setEPosition(d.positionTitle ?? '')
      setEDept(d.primaryDepartmentId ? String(d.primaryDepartmentId) : '')
      setEGender((d.gender as string) || 'unspecified')
      setEBirth(dateForInput(d.birthDate))
    } catch (e) {
      setEErr(formatApiError(e))
    } finally {
      setEBusy(false)
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateMsg(null)
    setCBusy(true)
    try {
      const body: Record<string, unknown> = {
        email: cEmail.trim(),
        fullName: cFullName.trim(),
      }
      if (cPassword.trim()) {
        body.password = cPassword
      }
      if (cPhone.trim()) {
        body.phone = cPhone.trim()
      }
      if (cMajor.trim()) {
        body.major = cMajor.trim()
      }
      if (cDept) {
        body.primaryDepartmentId = Number(cDept)
      }
      if (cGender) {
        body.gender = cGender
      }
      if (cBirth) {
        body.birthDate = cBirth
      }
      const out = await apiJson<{
        temporaryPassword?: string
        member: MemberDetail
      }>('/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (out.temporaryPassword) {
        setCreateMsg(
          `Mật khẩu tạm (chỉ hiển thị lần này): ${out.temporaryPassword}`,
        )
      } else {
        setCreateOpen(false)
        resetCreateForm()
      }
      await loadList()
    } catch (er) {
      setCreateMsg(formatApiError(er))
    } finally {
      setCBusy(false)
    }
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) {
      return
    }
    setEErr(null)
    setEBusy(true)
    try {
      const body: Record<string, unknown> = {
        fullName: eFullName.trim(),
        gender: eGender,
        phone: ePhone.trim() || null,
        major: eMajor.trim() || null,
        positionTitle: ePosition.trim() || null,
        primaryDepartmentId: eDept ? Number(eDept) : null,
        birthDate: eBirth || null,
      }
      await apiJson(`/members/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setEditOpen(false)
      setEditingId(null)
      setEditDetail(null)
      await loadList()
    } catch (er) {
      setEErr(formatApiError(er))
    } finally {
      setEBusy(false)
    }
  }

  function openMembership(userId: string, name: string, status: string) {
    setMemErr(null)
    setMemId(userId)
    setMemName(name)
    setMemStatus(status === 'inactive' ? 'inactive' : 'active')
    setMemReason('')
    setMemOpen(true)
  }

  async function onSaveMembership() {
    if (!memId) {
      return
    }
    setMemErr(null)
    setMBusy(true)
    try {
      const body: { status: 'active' | 'inactive'; reason?: string } = {
        status: memStatus,
      }
      if (memStatus === 'inactive' && memReason.trim()) {
        body.reason = memReason.trim()
      }
      await apiJson(`/members/${memId}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setMemOpen(false)
      setMemId(null)
      await loadList()
    } catch (e) {
      setMemErr(formatApiError(e))
    } finally {
      setMBusy(false)
    }
  }

  async function onDelete(userId: string, name: string) {
    if (user && user.id === userId) {
      return
    }
    if (!window.confirm(`Xóa hẳn tài khoản và hồ sơ của ${name}? Không thể hoàn tác.`)) {
      return
    }
    try {
      await apiJson(`/members/${userId}`, { method: 'DELETE' })
      await loadList()
    } catch (e) {
      window.alert(formatApiError(e))
    }
  }

  if (!lead) {
    return (
      <div className="text-muted-foreground px-4 py-6 text-sm md:px-6">
        Chỉ lãnh đạo/điều hành CLB mới xem danh sách toàn bộ hội viên. Liên
        hệ BCH nếu bạn cần quyền.
      </div>
    )
  }
  if (loading) {
    return (
      <div className="px-4 py-4 md:py-6 lg:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40" />
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
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
        <div>
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Thành viên
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Quản lý hội viên (BCH, ban điều hành, trưởng ban). Tổng:{' '}
            <span className="text-foreground font-medium">{data.total}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            pressed={includeInactive}
            onPressedChange={(p) => setIncludeInactive(!!p)}
            variant="outline"
            size="sm"
            aria-label="Hiện cả hội viên đã nghỉ"
          >
            Gồm cả hội viên đã nghỉ
          </Toggle>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            Thêm thành viên
          </Button>
        </div>
      </div>

      <Card className="mx-4 border-border/60 shadow-sm lg:mx-6">
        <CardHeader>
          <CardTitle className="text-base">Danh sách</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ban</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-[60px] text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/app/members/${m.userId}`}
                      className="text-foreground hover:underline"
                    >
                      {m.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {m.email ?? '—'}
                  </TableCell>
                  <TableCell>
                    {m.primaryDepartment
                      ? `${m.primaryDepartment.name} (${m.primaryDepartment.code})`
                      : '—'}
                  </TableCell>
                  <TableCell>{m.membershipStatus}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Thao tác"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/app/members/${m.userId}`}>
                            Hồ sơ & thống kê
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void openEdit(m.userId)}
                        >
                          Sửa hồ sơ
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            openMembership(
                              m.userId,
                              m.fullName,
                              m.membershipStatus,
                            )
                          }
                          disabled={user?.id === m.userId}
                        >
                          Trạng thái hội viên
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void onDelete(m.userId, m.fullName)}
                          disabled={user?.id === m.userId}
                        >
                          Xóa tài khoản
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) {
            resetCreateForm()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>Thêm thành viên</DialogTitle>
              <DialogDescription>
                Tạo tài khoản và hồ sơ hội viên. Để trống mật khẩu để hệ thống
                tạo mật khẩu tạm.
              </DialogDescription>
            </DialogHeader>
            {createMsg && (
              <p
                className={
                  createMsg.startsWith('Mật')
                    ? 'text-foreground border-border bg-muted/50 rounded-md border p-3 text-sm'
                    : 'text-destructive text-sm'
                }
                role="status"
              >
                {createMsg}
              </p>
            )}
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-fn">Họ tên</Label>
                <Input
                  id="c-fn"
                  value={cFullName}
                  onChange={(e) => setCFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-pw">Mật khẩu (tùy chọn)</Label>
                <Input
                  id="c-pw"
                  type="password"
                  value={cPassword}
                  onChange={(e) => setCPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Điện thoại</Label>
                <Input
                  id="c-phone"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-major">Chuyên ngành</Label>
                <Input
                  id="c-major"
                  value={cMajor}
                  onChange={(e) => setCMajor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ban (tùy chọn)</Label>
                <Select
                  value={cDept || 'none'}
                  onValueChange={(v) => setCDept(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn ban" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Giới tính</Label>
                <Select value={cGender} onValueChange={setCGender}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Chưa nêu</SelectItem>
                    <SelectItem value="male">Nam</SelectItem>
                    <SelectItem value="female">Nữ</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-birth">Ngày sinh</Label>
                <Input
                  id="c-birth"
                  type="date"
                  value={cBirth}
                  onChange={(e) => setCBirth(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (createMsg?.startsWith('Mật')) {
                    setCreateOpen(false)
                    resetCreateForm()
                  } else {
                    setCreateOpen(false)
                  }
                }}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={cBusy}>
                {cBusy ? 'Đang tạo…' : 'Tạo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <form onSubmit={onSaveEdit}>
            <DialogHeader>
              <DialogTitle>Sửa hồ sơ</DialogTitle>
              <DialogDescription>
                {editDetail?.email
                  ? `Tài khoản: ${editDetail.email}`
                  : 'Chi tiết hội viên'}
              </DialogDescription>
            </DialogHeader>
            {eErr && (
              <p className="text-destructive text-sm" role="alert">
                {eErr}
              </p>
            )}
            {eBusy && !editDetail && (
              <p className="text-muted-foreground text-sm">Đang tải…</p>
            )}
            {editDetail && (
              <div className="grid gap-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="e-fn">Họ tên</Label>
                  <Input
                    id="e-fn"
                    value={eFullName}
                    onChange={(e) => setEFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-pos">Chức vụ (hiển thị trên hồ sơ)</Label>
                  <Input
                    id="e-pos"
                    value={ePosition}
                    onChange={(e) => setEPosition(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-phone">Điện thoại</Label>
                  <Input
                    id="e-phone"
                    value={ePhone}
                    onChange={(e) => setEPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-major">Chuyên ngành</Label>
                  <Input
                    id="e-major"
                    value={eMajor}
                    onChange={(e) => setEMajor(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ban</Label>
                  <Select
                    value={eDept || 'none'}
                    onValueChange={(v) => setEDept(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn ban" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Giới tính</Label>
                  <Select value={eGender} onValueChange={setEGender}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Chưa nêu</SelectItem>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                      <SelectItem value="other">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-birth">Ngày sinh</Label>
                  <Input
                    id="e-birth"
                    type="date"
                    value={eBirth}
                    onChange={(e) => setEBirth(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Đóng
              </Button>
              <Button type="submit" disabled={eBusy || !editDetail}>
                {eBusy ? 'Đang lưu…' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={memOpen} onOpenChange={setMemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trạng thái hội viên</DialogTitle>
            <DialogDescription>
              {memName} — cập nhật hội viên đang hoạt động / đã nghỉ. Khi nghỉ, tài
              khoản sẽ bị vô hiệu.
            </DialogDescription>
          </DialogHeader>
          {memErr && (
            <p className="text-destructive text-sm" role="alert">
              {memErr}
            </p>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select
                value={memStatus}
                onValueChange={(v) => setMemStatus(v as 'active' | 'inactive')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Đang hoạt động</SelectItem>
                  <SelectItem value="inactive">Đã nghỉ (inactive)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {memStatus === 'inactive' && (
              <div className="space-y-1.5">
                <Label htmlFor="m-reason">Ghi chú nghỉ (tùy chọn)</Label>
                <Textarea
                  id="m-reason"
                  value={memReason}
                  onChange={(e) => setMemReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void onSaveMembership()}
              disabled={mBusy}
            >
              {mBusy ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
