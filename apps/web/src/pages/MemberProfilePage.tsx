import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { isClubLeadership, roleCodesFromUser } from '@/lib/roles'
import type { MemberEngagementProfile } from '@/types/memberProfile'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const PIE1_COLORS = ['#22c55e', '#3b82f6', '#f97316']
const PIE2_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#64748b']

function fmtD(v: string | null) {
  if (!v) {
    return '—'
  }
  return new Date(v).toLocaleString('vi-VN')
}

function fmtDateShort(v: string) {
  return new Date(v).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type PieRow = { name: string; value: number }

function MemberPie({
  title,
  description,
  data,
  colors,
  emptyHint,
  className,
}: {
  title: string
  description: string
  data: PieRow[]
  colors: string[]
  emptyHint: string
  className?: string
}) {
  const has = data.length > 0 && data.some((d) => d.value > 0)
  return (
    <Card
      className={cn('border-border/60 flex h-full min-h-[280px] flex-col overflow-hidden', className)}
    >
      <CardHeader className="shrink-0 space-y-1 pb-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pb-4">
        {!has ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{emptyHint}</p>
        ) : (
          <div className="h-56 w-full min-w-0 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="42%"
                  outerRadius="70%"
                  paddingAngle={2}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={colors[i % colors.length]}
                      stroke="hsl(var(--background))"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <RechartTooltip
                  formatter={(value: number) => [value, 'Lượt / sự kiện']}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ fontSize: 11, paddingLeft: 4 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MemberProfilePage() {
  const { userId: routeId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const lead = user ? isClubLeadership(roleCodesFromUser(user)) : false
  const [data, setData] = useState<MemberEngagementProfile | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!routeId) {
      return
    }
    setErr(null)
    setLoading(true)
    try {
      const r = await apiJson<MemberEngagementProfile>(
        `/analytics/member-profile/${encodeURIComponent(routeId)}`,
      )
      setData(r)
    } catch (e) {
      setData(null)
      setErr(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }, [routeId])

  useEffect(() => {
    void load()
  }, [load])

  if (!routeId) {
    return null
  }

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-6 md:px-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="px-4 py-6 md:px-6">
        <p className="text-destructive text-sm" role="alert">
          {err ?? 'Không tải được dữ liệu.'}
        </p>
        {lead && (
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/app/members">Quay lại danh sách</Link>
          </Button>
        )}
      </div>
    )
  }

  const p = data.profile
  const pie1: PieRow[] = data.participationPie.map((s) => ({
    name: s.name,
    value: s.value,
  }))
  const pie2: PieRow[] = data.conductPie.map((s) => ({ name: s.name, value: s.value }))

  return (
    <div className="flex min-h-0 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {lead && (
            <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-8 px-2" asChild>
              <Link to="/app/members" className="text-muted-foreground gap-1.5">
                <IconArrowLeft className="size-4" />
                Danh sách thành viên
              </Link>
            </Button>
          )}
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            {p.fullName}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm break-all">
            {p.email ?? '—'}
            {p.primaryDepartment && (
              <span>
                {' '}
                · {p.primaryDepartment.name}{' '}
                <span className="text-muted-foreground/80">({p.primaryDepartment.code})</span>
              </span>
            )}
          </p>
        </div>
        <div className="bg-muted/50 border-border/60 flex shrink-0 items-baseline gap-2 rounded-lg border px-3 py-2">
          <span className="text-muted-foreground text-xs">Điểm rèn luyện (quý hiện tại)</span>
          <span className="text-foreground text-2xl font-bold tabular-nums">
            {data.quarter.score}
          </span>
          <span className="text-muted-foreground text-xs">{data.quarter.label}</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/60 md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Thông tin</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Số điện thoại</dt>
                <dd className="font-medium">{p.phone?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Ngành / chuyên ngành</dt>
                <dd className="font-medium">{p.major?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Giới tính</dt>
                <dd className="font-medium">
                  {p.gender === 'male'
                    ? 'Nam'
                    : p.gender === 'female'
                      ? 'Nữ'
                      : p.gender === 'unspecified'
                        ? '—'
                        : p.gender}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Ngày sinh</dt>
                <dd className="font-medium">
                  {p.birthDate ? String(p.birthDate).slice(0, 10) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Vị trí</dt>
                <dd className="font-medium">{p.positionTitle?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Trạng thái hội viên</dt>
                <dd className="font-medium">{p.membershipStatus}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Gia nhập</dt>
                <dd className="font-medium">{fmtD(p.joinedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Đăng nhập gần nhất</dt>
                <dd className="font-medium">{p.lastLoginAt ? fmtD(p.lastLoginAt) : '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Điểm tích lũy</CardTitle>
            <CardDescription className="text-xs">{data.sinceJoin.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-bold tabular-nums">{data.sinceJoin.score}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Sự kiện tham dự: {data.sinceJoin.eventsParticipated} · Hoàn hảo:{' '}
              {data.sinceJoin.eventsPerfectParticipation}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MemberPie
          title="Sự kiện (từ khi gia nhập)"
          description="Tỷ lệ theo số sự kiện: đã check-in, đã đăng ký mà sự kiện chưa diễn ra, hoặc đã qua mốc bắt đầu mà chưa check-in."
          data={pie1}
          colors={PIE1_COLORS}
          emptyHint="Chưa có dữ liệu đăng ký sự kiện trong phạm vi này."
        />
        <MemberPie
          title="Hành vi tham gia (từ khi gia nhập)"
          description="Phân bổ buổi họp (đúng giờ, trễ, ngoài khung, vắng) cùng xin nghỉ / hủy tham gia (đã duyệt)."
          data={pie2}
          colors={PIE2_COLORS}
          emptyHint="Chưa có số liệu buổi họp / nghỉ trong phạm vi này."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Sự kiện sắp tới (đã đăng ký)</CardTitle>
            <CardDescription className="text-xs">
              Các sự kiện đã duyệt đăng ký, mốc bắt đầu sau hiện tại.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.events.upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">Không có mục nào.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.events.upcoming.map((e) => (
                  <li
                    key={e.eventId}
                    className="border-border/60 flex flex-col gap-0.5 rounded-md border p-2"
                  >
                    <Link
                      to={`/app/events/${e.eventId}`}
                      className="text-foreground font-medium hover:underline"
                    >
                      {e.title}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {fmtDateShort(e.startAt)} · {e.status}
                      {e.hasCheckin && (
                        <span className="text-foreground"> · Đã check-in</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Đã tham gia / qua mốc</CardTitle>
            <CardDescription className="text-xs">
              Sự kiện đã qua mốc bắt đầu (đã đăng ký trước đó).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.events.past.length === 0 ? (
              <p className="text-muted-foreground text-sm">Không có mục nào.</p>
            ) : (
              <ul className="max-h-[min(50vh,24rem)] space-y-2 overflow-y-auto pr-1 text-sm">
                {data.events.past.map((e) => (
                  <li
                    key={e.eventId}
                    className="border-border/60 flex flex-col gap-0.5 rounded-md border p-2"
                  >
                    <Link
                      to={`/app/events/${e.eventId}`}
                      className="text-foreground font-medium hover:underline"
                    >
                      {e.title}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {fmtDateShort(e.startAt)} · {e.status}
                      {e.hasCheckin ? (
                        <span className="text-foreground"> · Đã check-in</span>
                      ) : (
                        <span> · Chưa check-in</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
