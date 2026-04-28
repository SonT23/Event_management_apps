import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { eventStatusLabel } from '@/lib/statusLabels'
import type { OrgDrilldownResponse } from '@/types/event'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** Khóa thẻ chỉ số → query `section` cho GET /org/summary/drilldown */
export const ORG_DRILL_SECTIONS: Record<string, string> = {
  mt: 'members_all',
  m: 'members',
  ev: 'events_all',
  up: 'events_upcoming',
  ra: 'registrations_approved',
  rp: 'registrations_pending',
  ci: 'checkins',
  pc: 'participation_cancellations_pending',
}

function formatDrillValue(columnKey: string, raw: string) {
  if (raw === '—' || !raw) {
    return raw
  }
  if (columnKey === 'status') {
    if (raw === 'active' || raw === 'inactive') {
      return raw === 'active' ? 'Hoạt động' : 'Không hoạt động'
    }
    return eventStatusLabel(raw)
  }
  if (
    columnKey.endsWith('At') ||
    columnKey === 'checkIn' ||
    columnKey === 'scannedAt' ||
    columnKey === 'createdAt'
  ) {
    const t = new Date(raw)
    if (!Number.isNaN(t.getTime())) {
      return t.toLocaleString('vi-VN')
    }
  }
  return raw
}

function isIsoMonthKey(s: string) {
  return /^\d{4}-\d{2}$/.test(s)
}

export function monthKeyLabel(s: string) {
  if (!isIsoMonthKey(s)) {
    return s
  }
  const [y, m] = s.split('-')
  return `T${Number(m)}/${y}`
}

function renderDrillCell(
  column: { key: string; label: string },
  row: Record<string, string>,
) {
  const raw = row[column.key] ?? '—'
  const v = formatDrillValue(column.key, raw)
  if (column.key === 'eventId' && row.eventId) {
    return (
      <Link
        to={`/app/events/${row.eventId}`}
        className="text-primary text-sm font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.eventId}
      </Link>
    )
  }
  if (column.key === 'eventTitle' && row.eventId) {
    return (
      <Link
        to={`/app/events/${row.eventId}`}
        className="text-primary line-clamp-2 text-left text-sm font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {v}
      </Link>
    )
  }
  return <span className="max-w-[10rem] truncate text-sm sm:max-w-none">{v}</span>
}

export function useOrgDrilldown() {
  const [sheetOpen, setSheetOpenState] = useState(false)
  const [drill, setDrill] = useState<OrgDrilldownResponse | null>(null)
  const [drillLoad, setDrillLoad] = useState(false)
  const [drillErr, setDrillErr] = useState<string | null>(null)
  const [drillTitleHint, setDrillTitleHint] = useState('')

  const setSheetOpen = useCallback((open: boolean) => {
    setSheetOpenState(open)
    if (!open) {
      setDrillErr(null)
    }
  }, [])

  const openDrill = useCallback((statId: string, labelHint?: string) => {
    const section = ORG_DRILL_SECTIONS[statId]
    if (!section) {
      return
    }
    setDrillTitleHint(labelHint?.trim() || '')
    setSheetOpenState(true)
    setDrill(null)
    setDrillErr(null)
    setDrillLoad(true)
    void (async () => {
      try {
        const d = await apiJson<OrgDrilldownResponse>(
          `/org/summary/drilldown?section=${encodeURIComponent(section)}`,
        )
        setDrill(d)
      } catch (e) {
        setDrillErr(formatApiError(e))
      } finally {
        setDrillLoad(false)
      }
    })()
  }, [])

  return {
    sheetOpen,
    setSheetOpen,
    drill,
    drillLoad,
    drillErr,
    drillTitleHint,
    openDrill,
  }
}

type OrgDrilldownSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  drill: OrgDrilldownResponse | null
  drillLoad: boolean
  drillErr: string | null
  drillTitleHint: string
}

export function OrgDrilldownSheet({
  open,
  onOpenChange,
  drill,
  drillLoad,
  drillErr,
  drillTitleHint,
}: OrgDrilldownSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          // parent may clear err
        }
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl lg:max-w-4xl"
      >
        <SheetHeader className="border-border/60 space-y-1 border-b px-6 py-4 text-left">
          <SheetTitle className="pr-8">
            {drillLoad
              ? (drillTitleHint || 'Chi tiết')
              : (drill?.title ?? 'Chi tiết')}
          </SheetTitle>
          <SheetDescription className="text-xs sm:text-sm">
            Dữ liệu theo từng mục tổng quan. Trạng thái sự kiện và thời gian hiển
            thị theo múi giờ hệ thống.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-4">
          {drillErr && (
            <p className="text-destructive text-sm" role="alert">
              {drillErr}
            </p>
          )}
          {drillLoad && !drillErr && (
            <div className="space-y-3 py-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          )}
          {!drillLoad && drill?.chart && drill.chart.points.length > 0 && (
            <div className="mb-6 h-52">
              <p className="text-muted-foreground mb-2 text-sm font-medium">
                {drill.chart.label}
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={drill.chart.points.map((p) => ({
                    name: p.label,
                    v: p.value,
                  }))}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    height={drill.section === 'events_all' ? 64 : 36}
                    tickFormatter={(v: string) =>
                      isIsoMonthKey(String(v))
                        ? monthKeyLabel(String(v))
                        : eventStatusLabel(String(v))
                    }
                  />
                  <YAxis allowDecimals={false} width={40} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(val: number) => [
                      val.toLocaleString('vi-VN'),
                      'Lượt',
                    ]}
                    labelFormatter={(lab) =>
                      isIsoMonthKey(String(lab))
                        ? monthKeyLabel(String(lab))
                        : eventStatusLabel(String(lab))
                    }
                  />
                  <Bar
                    dataKey="v"
                    fill="var(--chart-1)"
                    radius={[3, 3, 0, 0]}
                    name="Số lượng"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {!drillLoad && drill?.table && (
            <div className="max-h-[min(60dvh,640px)] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {drill.table.columns.map((c) => (
                      <TableHead
                        key={c.key}
                        className="whitespace-nowrap text-xs sm:text-sm"
                      >
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drill.table.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={drill.table.columns.length}
                        className="text-muted-foreground text-center text-sm"
                      >
                        Không có bản ghi.
                      </TableCell>
                    </TableRow>
                  ) : (
                    drill.table.rows.map((row, i) => (
                      <TableRow key={`${i}-${row.id ?? i}`}>
                        {drill.table!.columns.map((c) => (
                          <TableCell
                            key={c.key}
                            className="align-top text-xs sm:text-sm"
                          >
                            {renderDrillCell(c, row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {!drillLoad && drill && !drill.table && !drill.chart && !drillErr && (
            <p className="text-muted-foreground text-sm">Không có dữ liệu.</p>
          )}
          {drill && !drillLoad && (
            <div className="text-muted-foreground mt-4 flex flex-wrap gap-2 text-xs">
              {['users', 'members', 'members_all'].includes(drill.section) && (
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/app/members"
                    onClick={() => onOpenChange(false)}
                  >
                    Mở danh sách hội viên
                  </Link>
                </Button>
              )}
              {[
                'events_all',
                'events_upcoming',
                'registrations_approved',
                'registrations_pending',
                'checkins',
                'participation_cancellations_pending',
              ].includes(drill.section) && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/events" onClick={() => onOpenChange(false)}>
                    Mở sự kiện
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
