import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { useAuth } from '@/context/AuthContext'
import { api, apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { isClubLeadership, roleCodesFromUser } from '@/lib/roles'
import { eventStatusLabel, registrationStatusLabel } from '@/lib/statusLabels'
import type {
  CheckinListRow,
  EventListItem,
  RegistrationListRow,
} from '@/types/event'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EventMeetingsBlock } from '@/pages/EventMeetingsBlock'
import { EventSubcommitteesBlock } from '@/pages/EventSubcommitteesBlock'
import { EventSettingsPanel } from '@/pages/EventSettingsPanel'

type Mgr = { userId: string; fullName: string | null; email: string | null }
type MyReg = { id: string; eventId: string; status: string }

function statusBadgeVariant(s: string) {
  if (s === 'approved') {
    return 'default' as const
  }
  if (s === 'pending') {
    return 'secondary' as const
  }
  if (s === 'rejected' || s === 'cancelled') {
    return 'outline' as const
  }
  return 'secondary' as const
}

export function EventDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ev, setEv] = useState<EventListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [myReg, setMyReg] = useState<MyReg | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [managers, setManagers] = useState<Mgr[]>([])
  const [regs, setRegs] = useState<RegistrationListRow[] | null>(null)
  const [checkins, setCheckins] = useState<{
    items: CheckinListRow[]
    total: number
  } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrBusy, setQrBusy] = useState(false)

  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false

  const loadEvent = useCallback(async () => {
    if (!id) {
      return
    }
    const e = await apiJson<EventListItem>(`/events/${id}`)
    setEv(e)
  }, [id])

  const loadManagerData = useCallback(
    async (eventId: string) => {
      const [m, r, c] = await Promise.all([
        api(`/events/${eventId}/managers`),
        api(`/events/${eventId}/registrations`),
        api(`/events/${eventId}/check-ins`),
      ])
      if (m.ok) {
        setManagers((await m.json()) as Mgr[])
      } else {
        setManagers([])
      }
      if (r.ok) {
        setRegs((await r.json()) as RegistrationListRow[])
      } else {
        setRegs(null)
      }
      if (c.ok) {
        setCheckins(await c.json())
      } else {
        setCheckins(null)
      }
    },
    [],
  )

  const userId = user?.id
  const refresh = useCallback(async () => {
    if (!id || !userId) {
      return
    }
    setErr(null)
    setActionErr(null)
    await loadEvent()
    const mineR = await api('/registrations/me')
    if (mineR.ok) {
      const all = (await mineR.json()) as MyReg[]
      setMyReg(all.find((r) => r.eventId === id) ?? null)
    } else {
      setMyReg(null)
    }
    const mgrR = await api(`/events/${id}/managers`)
    if (mgrR.status === 200) {
      setCanManage(true)
      await loadManagerData(id)
    } else {
      setCanManage(false)
      setManagers([])
      setRegs(null)
      setCheckins(null)
    }
  }, [id, userId, loadEvent, loadManagerData])

  useEffect(() => {
    let o = true
    ;(async () => {
      if (!id) {
        return
      }
      setLoading(true)
      try {
        await refresh()
      } catch (e) {
        if (o) {
          setErr(formatApiError(e))
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
  }, [id, refresh])

  /** Duyệt/điểm danh: API chỉ chấp nhận lãnh đạo CLB hoặc quản lý sự kiện (bảng event_managers) */
  const canReviewRegs =
    !!user && (lead || managers.some((m) => m.userId === user.id))

  async function doPublish() {
    if (!id) {
      return
    }
    setActionErr(null)
    try {
      await apiJson(`/events/${id}/publish`, { method: 'POST' })
      await refresh()
    } catch (e) {
      setActionErr(formatApiError(e))
    }
  }

  async function doEnd() {
    if (!id) {
      return
    }
    setActionErr(null)
    try {
      await apiJson(`/events/${id}/end`, { method: 'POST' })
      await refresh()
    } catch (e) {
      setActionErr(formatApiError(e))
    }
  }

  async function register() {
    if (!id) {
      return
    }
    setActionErr(null)
    try {
      await apiJson(`/events/${id}/registrations`, { method: 'POST' })
      await refresh()
    } catch (e) {
      setActionErr(formatApiError(e))
    }
  }

  async function showQr() {
    if (!myReg?.id) {
      return
    }
    setQrBusy(true)
    setActionErr(null)
    try {
      const o = (await apiJson<{ qrToken: string }>(
        `/registrations/${myReg.id}/rotate-qr`,
        { method: 'POST' },
      ))!
      const url = await QRCode.toDataURL(o.qrToken, { width: 240, margin: 1 })
      setQrDataUrl(url)
    } catch (e) {
      setActionErr(formatApiError(e))
    } finally {
      setQrBusy(false)
    }
  }

  async function approveR(registrationId: string) {
    setActionErr(null)
    try {
      await apiJson(`/registrations/${registrationId}/approve`, {
        method: 'POST',
      })
      await refresh()
    } catch (e) {
      setActionErr(formatApiError(e))
    }
  }

  async function rejectR(registrationId: string) {
    setActionErr(null)
    try {
      await apiJson(`/registrations/${registrationId}/reject`, {
        method: 'POST',
      })
      await refresh()
    } catch (e) {
      setActionErr(formatApiError(e))
    }
  }

  if (loading || !id) {
    return (
      <div className="p-4 md:p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-4 h-24" />
      </div>
    )
  }
  if (err || !ev) {
    return (
      <div className="text-destructive p-4 text-sm" role="alert">
        {err ?? 'Không tìm thấy sự kiện.'}
      </div>
    )
  }

  const openForRegister =
    ev.status === 'published' || ev.status === 'ongoing'

  const isCreator = !!user && user.id === ev.createdBy

  return (
    <div className="space-y-6 px-4 py-4 md:py-6 lg:px-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-xl font-semibold">{ev.title}</h2>
          <Badge variant="secondary">{eventStatusLabel(ev.status)}</Badge>
        </div>
        {ev.creatorEmail && (
          <p className="text-muted-foreground text-sm">
            Người tạo: {ev.creatorEmail}
          </p>
        )}
        {(ev.managers?.length ?? 0) > 0 ? (
          <div className="mt-1.5">
            <p className="text-muted-foreground text-xs">Quản lý sự kiện</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {(ev.managers ?? []).map((m) => (
                <Badge
                  key={m.userId}
                  variant="secondary"
                  className="text-xs font-medium"
                >
                  {m.fullName?.trim() || m.email || m.userId}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground mt-1 max-w-lg text-xs">
            Chưa chỉ định quản lý riêng; lãnh đạo CLB và người tạo sự kiện vẫn có
            quyền quản lý.
          </p>
        )}
        <p className="text-sm">
          Bắt đầu: {new Date(ev.startAt).toLocaleString('vi-VN')}
          {ev.expectedEndAt && (
            <>
              {' '}
              — Dự kiến kết thúc:{' '}
              {new Date(ev.expectedEndAt).toLocaleString('vi-VN')}
            </>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          ID: {ev.id} · Đăng ký:{' '}
          {ev.requiresApproval ? 'cần duyệt (requires_approval)' : 'tự duyệt'}
          {ev.defaultCancelMinutes != null &&
            ` · Huỷ trước ít nhất ${ev.defaultCancelMinutes} phút`}
        </p>
      </div>
      {ev.description && (
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">
          {ev.description}
        </p>
      )}

      <EventSettingsPanel
        eventId={id}
        event={ev}
        canManage={canManage}
        canAddManagers={lead || isCreator}
        canDeleteEvent={lead || (isCreator && ev.status === 'draft')}
        lead={lead}
        isCreator={isCreator}
        managers={managers}
        onRefresh={refresh}
        onDeleted={() => navigate('/app/events')}
      />

      <EventMeetingsBlock
        eventId={id}
        eventStartAt={ev.startAt}
        canManage={canManage}
        canScanAttendance={canReviewRegs}
        eventStatus={ev.status}
      />

      <EventSubcommitteesBlock
        eventId={id}
        canManage={canManage}
        approvedRegs={(regs ?? [])
          .filter((r) => r.status === 'approved')
          .map((r) => ({
            userId: r.userId,
            fullName: r.fullName ?? null,
            email: r.email,
          }))}
      />

      {actionErr && (
        <p className="text-destructive text-sm" role="alert">
          {actionErr}
        </p>
      )}

      {canManage &&
        (ev.status === 'draft' ||
          ev.status === 'published' ||
          ev.status === 'ongoing') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thao tác quản lý</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {ev.status === 'draft' && (
                <Button type="button" onClick={doPublish}>
                  Công bố sự kiện
                </Button>
              )}
              {(ev.status === 'published' || ev.status === 'ongoing') && (
                <Button type="button" variant="secondary" onClick={doEnd}>
                  Kết thúc sự kiện
                </Button>
              )}
              <Button type="button" asChild variant="outline">
                <Link to={`/app/booth/${id}`}>
                  Mở kiosk check-in (quét QR)
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tham gia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!myReg && openForRegister && (
              <Button type="button" onClick={register}>
                Đăng ký tham gia
              </Button>
            )}
            {myReg && (
              <div className="space-y-1 text-sm">
                <p>
                  Trạng thái đăng ký:{' '}
                  <Badge variant={statusBadgeVariant(myReg.status)}>
                    {registrationStatusLabel(myReg.status)}
                  </Badge>
                </p>
                {myReg.status === 'approved' && (
                  <div className="space-y-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={showQr}
                      disabled={qrBusy}
                    >
                      {qrBusy ? 'Đang tạo mã…' : 'Tạo / làm mới mã QR check-in'}
                    </Button>
                    {qrDataUrl && (
                      <div className="pt-1">
                        <img
                          className="rounded border p-1"
                          src={qrDataUrl}
                          width={240}
                          height={240}
                          alt="Mã QR tham dự"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                          Mỗi lần bấm tạo mã mới, mã cũ sẽ hết hiệu lực.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {!openForRegister && !myReg && (
              <p className="text-muted-foreground text-sm">
                Sự kiện không mở đăng ký ở trạng thái hiện tại.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {canManage && regs && (
        <Tabs defaultValue="reg">
          <TabsList>
            <TabsTrigger value="reg">Đăng ký ({regs.length})</TabsTrigger>
            <TabsTrigger value="in">Check-in ({checkins?.total ?? 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="reg" className="pt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Check-in</TableHead>
                  {canReviewRegs && (
                    <TableHead className="text-right">Thao tác</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {regs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.fullName ?? r.email ?? r.userId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(r.status)}>
                        {registrationStatusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.checkedInAt
                        ? new Date(r.checkedInAt).toLocaleString('vi-VN')
                        : '—'}
                    </TableCell>
                    {canReviewRegs && r.status === 'pending' && (
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => approveR(r.id)}
                        >
                          Duyệt
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => rejectR(r.id)}
                        >
                          Từ chối
                        </Button>
                      </TableCell>
                    )}
                    {canReviewRegs && r.status !== 'pending' && (
                      <TableCell className="text-right">—</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="in" className="pt-2">
            {checkins?.items?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người tham dự</TableHead>
                    <TableHead>Thời điểm</TableHead>
                    <TableHead>Quét bởi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkins.items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {c.fullName ?? c.email ?? c.userId}
                      </TableCell>
                      <TableCell>
                        {new Date(c.scannedAt).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell>{c.scannerName ?? c.scannedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">
                Chưa có lượt check-in.
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
