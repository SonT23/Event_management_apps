import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
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
import type { OrgSummaryAllTime } from '@/types/event'
import { OrgDrilldownSheet, monthKeyLabel, useOrgDrilldown } from '@/components/org/OrgDrilldownSheet'
import { StatMetricCard } from '@/components/org/StatMetricCard'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function OrgReportsPage() {
  const { user } = useAuth()
  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false
  const [data, setData] = useState<OrgSummaryAllTime | null>(null)
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

  useEffect(() => {
    if (!lead) {
      return
    }
    let ok = true
    ;(async () => {
      setErr(null)
      try {
        const s = await apiJson<OrgSummaryAllTime>('/org/summary/all-time')
        if (ok) {
          setData(s)
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
  }, [lead])

  const regChartPoints = useMemo(() => {
    if (!data) {
      return []
    }
    return [
      { label: registrationStatusLabel('approved'), value: data.registrationsApproved },
      { label: registrationStatusLabel('pending'), value: data.registrationsPending },
      { label: registrationStatusLabel('rejected'), value: data.registrationsRejected },
      { label: registrationStatusLabel('cancelled'), value: data.registrationsCancelled },
    ]
  }, [data])

  if (!user) {
    return null
  }
  if (!lead) {
    return <Navigate to="/app/dashboard" replace />
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 @5xl/main:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="text-destructive p-4 text-sm md:px-6" role="alert">
        {err ?? 'Không tải được báo cáo.'}
      </div>
    )
  }

  const fromLabel = data.period.from
    ? new Date(data.period.from).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'
  const toLabel = new Date(data.period.to).toLocaleString('vi-VN')

  return (
    <div className="flex flex-col gap-6 px-4 py-4 md:gap-8 md:px-6 md:py-6">
      <div className="from-primary/8 border-border/60 relative overflow-hidden rounded-xl border bg-gradient-to-br to-card p-5 shadow-sm md:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/[0.07]" />
        <div className="relative space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Báo cáo tổng hợp
          </p>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Báo cáo đầy đủ
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
            Thống kê tích lũy toàn bộ hoạt động câu lạc bộ từ mốc dữ liệu sớm nhất
            đến thời điểm hiện tại. Các thẻ chỉ số dùng chung dữ liệu với bảng điều
            khiển; nhấn thẻ để mở bảng / biểu đồ chi tiết (toàn hệ thống).
          </p>
          <p className="text-muted-foreground text-xs">
            Mốc ước tính từ dữ liệu: <span className="text-foreground/90">{fromLabel}</span>
            {' — '}
            <time dateTime={data.period.to}>{toLabel}</time>
            . Cập nhật:{' '}
            <time dateTime={data.generatedAt}>
              {new Date(data.generatedAt).toLocaleString('vi-VN')}
            </time>
            .
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <StatMetricCard
          label="Tổng số thành viên"
          value={data.membersTotal}
          hint="Mọi trạng thái hội viên (tích lũy)."
          icon={IconUsers}
          interactive
          onOpen={() => openDrill('mt', 'Tổng số thành viên')}
        />
        <StatMetricCard
          label="Thành viên đang hoạt động"
          value={data.membersActive}
          hint="membership_status = active."
          icon={IconUserCheck}
          interactive
          onOpen={() => openDrill('m', 'Thành viên đang hoạt động')}
        />
        <StatMetricCard
          label="Sự kiện (tích lũy)"
          value={data.eventsTotal}
          hint="Tổng số sự kiện đã tạo, mọi trạng thái."
          icon={IconCalendarEvent}
          interactive
          onOpen={() => openDrill('ev', 'Sự kiện')}
        />
        <StatMetricCard
          label="Sự kiện sắp tới"
          value={data.eventsUpcoming}
          hint="Đã/đang công bố, bắt đầu từ bây giờ trở đi."
          icon={IconClockHour4}
          interactive
          onOpen={() => openDrill('up', 'Sự kiện sắp tới')}
        />
        <StatMetricCard
          label="Đăng ký đã duyệt (tích lũy)"
          value={data.registrationsApproved}
          hint="Mọi bản ghi đã duyệt từ trước đến nay."
          icon={IconCheck}
          interactive
          onOpen={() => openDrill('ra', 'Đăng ký đã duyệt')}
        />
        <StatMetricCard
          label="Đăng ký chờ duyệt (hiện tại)"
          value={data.registrationsPending}
          hint="Số bản ghi pending đang mở."
          icon={IconUsersGroup}
          interactive
          onOpen={() => openDrill('rp', 'Đăng ký chờ duyệt')}
        />
        <StatMetricCard
          label="Check-in (tích lũy)"
          value={data.checkinsTotal}
          hint="Tổng lượt quét mã tham dự sự kiện."
          icon={IconQrcode}
          interactive
          onOpen={() => openDrill('ci', 'Check-in')}
        />
        <StatMetricCard
          label="Hủy tham gia chờ xử lý"
          value={data.participationCancellationsPending}
          hint="Yêu cầu hủy đang pending."
          icon={IconFileAlert}
          interactive
          onOpen={() => openDrill('pc', 'Hủy tham gia')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Tài khoản hoạt động</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.usersActive.toLocaleString('vi-VN')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground pt-0 text-xs">
            users.is_active = true
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Buổi họp thuộc sự kiện</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.eventMeetingsTotal.toLocaleString('vi-VN')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground pt-0 text-xs">
            Tổng bản ghi event_meetings
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Cuộc họp nội bộ CLB</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.clubMeetingsTotal.toLocaleString('vi-VN')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground pt-0 text-xs">
            Tổng bản ghi club_meetings
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Vắng mặt sự kiện — chờ xử lý</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.absenceRequestsPending.toLocaleString('vi-VN')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground pt-0 text-xs">
            absence_requests pending (theo sự kiện)
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sự kiện theo trạng thái</CardTitle>
            <CardDescription>Toàn bộ thời gian</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.eventsByStatus.map((e) => ({
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
            <CardDescription>membership</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.membersByStatus.map((m) => ({
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
            <CardDescription>Tích lũy (mọi thời điểm)</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regChartPoints} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tick={{ fontSize: 10 }}
                />
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
            <CardDescription>24 tháng gần nhất (theo start_at)</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyEventStarts.map((r) => ({
                name: monthKeyLabel(r.month),
                c: r.count,
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={2} height={32} />
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

      <div className="border-border/60 flex flex-col gap-3 rounded-lg border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Cần so sánh theo <strong className="text-foreground">quý</strong>? Dùng bảng
          điều khiển và lọc năm / quý.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/dashboard">Bảng điều khiển theo quý</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/members">Hội viên</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/events">Sự kiện</Link>
          </Button>
        </div>
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
