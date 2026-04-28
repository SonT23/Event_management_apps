import { useEffect, useRef } from 'react'
import {
  IconBuildingBroadcastTower,
  IconCalendar,
  IconDashboard,
  IconFlask2,
  IconChartBar,
  IconFiles,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import { Link, useLocation } from 'react-router-dom'
import { isClubLeadership, roleCodesFromUser } from '@/lib/roles'
import { showLabFeature } from '@/lib/features'
import { useAuth } from '@/context/AuthContext'
import { MCNavUser } from '@/components/layout/MCNavUser'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

/** Thứ tự: Báo cáo đầy đủ → Báo cáo theo quý → Thành viên → Sự kiện → Cuộc họp → Xếp hạng */
const navItems = [
  {
    to: '/app/reports',
    label: 'Báo cáo đầy đủ',
    icon: IconFiles,
    leadOnly: true,
  },
  {
    to: '/app/dashboard',
    label: 'Báo cáo theo quý',
    icon: IconDashboard,
  },
  {
    to: '/app/members',
    label: 'Thành viên',
    icon: IconUsers,
    leadOnly: true,
  },
  { to: '/app/events', label: 'Sự kiện', icon: IconCalendar },
  { to: '/app/meetings', label: 'Cuộc họp', icon: IconUsersGroup },
  {
    to: '/app/discipline',
    label: 'Xếp hạng',
    icon: IconChartBar,
    leadOnly: true,
  },
] as const

const HOVER_CLOSE_MS = 220

export function MCSidebar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { setOpen, isMobile } = useSidebar()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Menu ba chấm (MCNavUser) render qua portal — chuột rời sidebar vẫn ở trên menu; không được coi là “rời sidebar” để đóng. */
  const accountMenuOpenRef = useRef(false)

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  useEffect(() => () => clearCloseTimer(), [])

  const codes = user ? roleCodesFromUser(user) : []
  const lead = isClubLeadership(codes)
  const lab = showLabFeature()

  const desktopHoverProps =
    isMobile
      ? undefined
      : {
          onMouseEnter: () => {
            clearCloseTimer()
            setOpen(true)
          },
          onMouseLeave: () => {
            if (accountMenuOpenRef.current) {
              return
            }
            clearCloseTimer()
            closeTimer.current = setTimeout(() => {
              setOpen(false)
            }, HOVER_CLOSE_MS)
          },
        }

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      {...desktopHoverProps}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5"
              size="lg"
            >
              <Link to="/app/dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
                  <IconBuildingBroadcastTower className="size-4" />
                </div>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Media Club</span>
                  <span className="text-sidebar-foreground/70 truncate text-xs">
                    Cổng nội bộ
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                if ('leadOnly' in item && item.leadOnly && !lead) {
                  return null
                }
                const Icon = item.icon
                const active =
                  item.to === '/app/events'
                    ? pathname.startsWith('/app/events')
                    : item.to === '/app/reports'
                      ? pathname.startsWith('/app/reports')
                      : item.to === '/app/dashboard'
                        ? pathname === '/app/dashboard'
                        : pathname === item.to
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
              {lab && lead && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/app/lab'}
                    tooltip="Lab tính năng"
                  >
                    <Link to="/app/lab">
                      <IconFlask2 className="size-4" />
                      <span>Lab</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <MCNavUser
          onAccountMenuOpenChange={(open) => {
            accountMenuOpenRef.current = open
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
