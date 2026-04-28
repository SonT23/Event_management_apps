import { useLocation } from 'react-router-dom'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

const titles: { prefix: string; label: string }[] = [
  { prefix: '/app/reports', label: 'Báo cáo đầy đủ' },
  { prefix: '/app/dashboard', label: 'Báo cáo theo quý' },
  { prefix: '/app/events', label: 'Sự kiện' },
  { prefix: '/app/members', label: 'Thành viên' },
  { prefix: '/app/meetings', label: 'Cuộc họp' },
  { prefix: '/app/discipline', label: 'Xếp hạng' },
  { prefix: '/app/booth-meeting', label: 'Điểm danh buổi họp' },
  { prefix: '/app/booth', label: 'Kiosk check-in' },
  { prefix: '/app/lab', label: 'Lab' },
]

function titleForPath(path: string) {
  if (/^\/app\/members\/[^/]+$/.test(path)) {
    return 'Hồ sơ thành viên'
  }
  if (path.startsWith('/app/events/')) {
    return 'Chi tiết sự kiện'
  }
  const t = titles.find(
    (x) => x.prefix === path || (x.prefix !== '/app' && path.startsWith(x.prefix)),
  )
  return t?.label ?? 'Media Club'
}

/**
 * Thanh trên cùng theo layout mẫu dashboard: trigger sidebar + tiêu đề trang.
 * Tài khoản nằm ở chân sidebar (MCNavUser).
 */
export function MCHeader() {
  const { pathname } = useLocation()
  return (
    <header className="bg-background/80 supports-backdrop-filter:bg-background/60 h-12 shrink-0 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex h-full w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:!h-4"
        />
        <h1 className="text-foreground min-w-0 flex-1 truncate text-base font-medium">
          {titleForPath(pathname)}
        </h1>
      </div>
    </header>
  )
}
