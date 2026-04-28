import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import {
  IconCalendarEvent,
  IconCheck,
  IconClockHour4,
  IconFileAlert,
  IconQrcode,
  IconUserCheck,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { isClubLeadership, roleCodesFromUser } from '@/lib/roles'
import {
  eventStatusLabel,
  membershipStatusLabel,
  registrationStatusLabel,
} from '@/lib/statusLabels'
import type { MyRegistration, OrgSummary } from '@/types/event'
import { ManagedEventsBlock } from '@/pages/ManagedEventsBlock'
import { monthKeyLabel, OrgDrilldownSheet, useOrgDrilldown } from '@/components/org/OrgDrilldownSheet'
import { StatMetricCard } from '@/components/org/StatMetricCard'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

type StatDef = {
  id: string
  label: string
  value: number
  hint: string
  icon: ComponentType<{ className?: string }>
}

export function DashboardPage() {
  const { user } = useAuth()
  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [mine, setMine] = useState<MyRegistration[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const {
    sheetOpen,
    setSheetOpen,
    drill,
    drillLoad,
    drillErr,
    drillTitleHint,
    openDrill,
  } = useOrgDrilldown()

  const currentQuarter = useCallback(() => {
    const d = new Date()
    return { y: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1 }
  }, [])

  const [summaryQuarter, setSummaryQuarter] = useState<{
    y: number
    q: number
  }>(() => currentQuarter())

  const memberStats = useMemo(() => {
    if (!mine) {
      return null
    }
    return {
      total: mine.length,
      pending: mine.filter((r) => r.status === 'pending').length,
      approved: mine.filter((r) => r.status === 'approved').length,
      checkedIn: mine.filter((r) => r.checkedInAt).length,
    }
  }, [mine])

  const regChartPoints = useMemo(() => {
    if (!summary) {
      return []
    }
    const map = new Map(
      summary.registrationsByStatus.map((r) => [r.status, r.count]),
    )
    return (['approved', 'pending', 'rejected', 'cancelled'] as const).map(
      (k) => ({
        label: registrationStatusLabel(k),
        value: map.get(k) ?? 0,
      }),
    )
  }, [summary])

  useEffect(() => {
    let ok = true
    ;(async () => {
      setErr(null)
      try {
        if (lead) {
          const s = await apiJson<OrgSummary>(
            `/org/summary?year=${summaryQuarter.y}&quarter=${summaryQuarter.q}`,
          )
          if (!ok) {
            return
          }
          setSummary(s)
        } else {
          const list = await apiJson<MyRegistration[]>('/registrations/me')
          if (!ok) {
            return
          }
          setMine(list)
        }
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
  }, [lead, summaryQuarter.y, summaryQuarter.q])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:px-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (err) {
    return (
      <div className="text-destructive p-4 text-sm md:px-6" role="alert">
        {err}
      </div>
    )
  }

  if (lead && summary) {
    const pl = summary.period?.label ?? `Q${summaryQuarter.q}/${summaryQuarter.y}`
    const stats: StatDef[] = [
      {
        id: 'mt',
        label: 'Tổng số thành viên',
        value: summary.membersTotal,
        hint: 'Tổng bản ghi trong bảng members (mọi trạng thái; không theo quý).',
        icon: IconUsers,
      },
      {
        id: 'm',
        label: 'Số thành viên đang hoạt động',
        value: summary.membersActive,
        hint: 'membership_status = active (không theo quý).',
        icon: IconUserCheck,
      },
      {
        id: 'ev',
        label: 'Sự kiện (trong kỳ)',
        value: summary.eventsTotal,
        hint: `Sự kiện có mốc bắt đầu từ ${pl}.`,
        icon: IconCalendarEvent,
      },
      {
        id: 'up',
        label: 'Sự kiện sắp tới (trong kỳ)',
        value: summary.eventsUpcoming,
        hint: `Đã/đang công bố, bắt đầu từ bây giờ trở đi và không sau ${pl}.`,
        icon: IconClockHour4,
      },
      {
        id: 'ra',
        label: 'Đăng ký đã duyệt (trong kỳ)',
        value: summary.registrationsApproved,
        hint: `Bản ghi duyệt có created_at thuộc ${pl}.`,
        icon: IconCheck,
      },
      {
        id: 'rp',
        label: 'Đăng ký chờ duyệt (trong kỳ)',
        value: summary.registrationsPending,
        hint: `Đăng ký pending tạo trong ${pl}.`,
        icon: IconUsersGroup,
      },
      {
        id: 'ci',
        label: 'Check-in (trong kỳ)',
        value: summary.checkinsTotal,
        hint: `Lượt quét mã có thời điểm quét thuộc ${pl}.`,
        icon: IconQrcode,
      },
      {
        id: 'pc',
        label: 'Hủy tham gia chờ xử lý',
        value: summary.participationCancellationsPending,
        hint: 'Toàn hệ thống: yêu cầu pending (không theo quý).',
        icon: IconFileAlert,
      },
    ]

    const yearOptions = [0, 1, 2, 3].map((d) => {
      const y = new Date().getFullYear() - d
      return y
    })

    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between lg:px-6">
          <div>
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              Tổng quan CLB
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Số liệu chính theo quý:{' '}
              <span className="text-foreground font-medium">{pl}</span> (
              {summary.period?.from && (
                <time dateTime={summary.period.from}>
                  {new Date(summary.period.from).toLocaleDateString('vi-VN')}
                </time>
              )}{' '}
              —{' '}
              {summary.period?.to && (
                <time dateTime={summary.period.to}>
                  {new Date(summary.period.to).toLocaleDateString('vi-VN')}
                </time>
              )}
              ). Chi tiết bảng khi bấm thẻ là <strong>toàn hệ thống</strong> (không
              lọc quý). Cập nhật:{' '}
              <time dateTime={summary.generatedAt}>
                {new Date(summary.generatedAt).toLocaleString('vi-VN')}
              </time>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Năm</Label>
              <Select
                value={String(summaryQuarter.y)}
                onValueChange={(v) =>
                  setSummaryQuarter((s) => ({ ...s, y: parseInt(v, 10) }))
                }
              >
                <SelectTrigger className="w-[7rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quý</Label>
              <Select
                value={String(summaryQuarter.q)}
                onValueChange={(v) =>
                  setSummaryQuarter((s) => ({
                    ...s,
                    q: parseInt(v, 10) as 1 | 2 | 3 | 4,
                  }))
                }
              >
                <SelectTrigger className="w-[5.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((q) => (
                    <SelectItem key={q} value={String(q)}>
                      Q{q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-0.5"
              asChild
            >
              <Link to="/app/reports">Báo cáo đầy đủ</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:px-6">
          {stats.map((s) => (
            <StatMetricCard
              key={s.id}
              label={s.label}
              value={s.value}
              hint={s.hint}
              icon={s.icon}
              interactive
              onOpen={() => openDrill(s.id, s.label)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sự kiện theo trạng thái</CardTitle>
                <CardDescription>
                  Trong kỳ {pl} (mốc bắt đầu sự kiện thuộc quý)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.eventsByStatus.map((e) => ({
                      name: eventStatusLabel(e.status),
                      v: e.count,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} height={56} />
                    <YAxis allowDecimals={false} width={32} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString('vi-VN'), 'Số lượng']}
                    />
                    <Bar dataKey="v" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Sự kiện" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hội viên theo trạng thái</CardTitle>
                <CardDescription>Ảnh chụp tại thời điểm tải (toàn hệ thống)</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.membersByStatus.map((m) => ({
                      name: membershipStatusLabel(m.status),
                      v: m.count,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={32} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString('vi-VN'), 'Người']}
                    />
                    <Bar dataKey="v" fill="var(--chart-2)" radius={[4, 4, 0, 0]} name="Hội viên" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Đăng ký sự kiện theo trạng thái</CardTitle>
                <CardDescription>
                  Bản ghi có thời điểm tạo trong kỳ {pl}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={regChartPoints}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString('vi-VN'), 'Bản ghi']}
                    />
                    <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sự kiện theo tháng bắt đầu</CardTitle>
                <CardDescription>
                  Ba tháng trong {pl} (theo mốc start_at trong từng tháng)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.monthlyEventStartsInQuarter.map((r) => ({
                      name: monthKeyLabel(r.month),
                      c: r.count,
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={28} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: number) => [v.toLocaleString('vi-VN'), 'Sự kiện']}
                    />
                    <Bar
                      dataKey="c"
                      fill="var(--chart-1)"
                      radius={[3, 3, 0, 0]}
                      name="Số sự kiện"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
          <Button asChild>
            <Link to="/app/events">Quản lý sự kiện</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/members">Danh sách hội viên</Link>
          </Button>
        </div>

        <OrgDrilldownSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          drill={drill}
          drillLoad={drillLoad}
          drillErr={drillErr}
          drillTitleHint={drillTitleHint}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Báo cáo theo quý (cá nhân)
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Tóm tắt đăng ký và tham gia sự kiện của bạn.
        </p>
      </div>

      {memberStats && (
        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 lg:px-6">
          {[
            { k: 'Tổng đăng ký', v: memberStats.total, d: 'Mọi trạng thái' },
            { k: 'Chờ duyệt', v: memberStats.pending, d: 'Đang chờ BCH/QL duyệt' },
            { k: 'Đã duyệt', v: memberStats.approved, d: 'Có thể dùng mã tham dự' },
            { k: 'Đã check-in', v: memberStats.checkedIn, d: 'Đã tham dự tại sự kiện' },
          ].map((x) => (
            <Card
              key={x.k}
              className="border-border/60 bg-gradient-to-t from-primary/[0.04] to-card"
            >
              <CardHeader className="pb-1">
                <CardDescription className="text-xs">{x.k}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{x.v}</CardTitle>
              </CardHeader>
              <CardFooter className="text-muted-foreground border-t-0 py-0 text-[11px]">
                {x.d}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <ManagedEventsBlock className="px-4 lg:px-6" />

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Đăng ký gần đây</CardTitle>
            <CardDescription>
              Tối đa 10 mục, liên kết tới trang sự kiện tương ứng
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mine && mine.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Bạn chưa có bản đăng ký nào. Duyệt sự kiện đang mở để tham gia.
              </p>
            )}
            {mine && mine.length > 0 && (
              <ul className="space-y-0">
                {mine.slice(0, 10).map((r, i) => (
                  <li key={r.id}>
                    {i > 0 && <Separator className="my-2" />}
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          className="text-foreground hover:text-primary text-sm font-medium"
                          to={`/app/events/${r.eventId}`}
                        >
                          {r.eventTitle}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {new Date(r.startAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {registrationStatusLabel(r.status)}
                        </Badge>
                        {r.checkedInAt && (
                          <span className="text-muted-foreground text-xs">
                            Check-in:{' '}
                            {new Date(r.checkedInAt).toLocaleString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Button asChild>
          <Link to="/app/events">Xem tất cả sự kiện</Link>
        </Button>
      </div>
    </div>
  )
}
