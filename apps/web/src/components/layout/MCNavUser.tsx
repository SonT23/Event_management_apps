import {
  IconDotsVertical,
  IconLayoutDashboard,
  IconLogout,
  IconUserCircle,
} from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

function initials(name: string, email: string) {
  const t = name.trim() || email
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  return t.slice(0, 2).toUpperCase() || 'MC'
}

type MCNavUserProps = {
  /** Gọi khi mở/đóng menu tài khoản (đồng bộ với tránh thu hover-sidebar khi dùng portal) */
  onAccountMenuOpenChange?: (open: boolean) => void
}

export function MCNavUser({ onAccountMenuOpenChange }: MCNavUserProps) {
  const { user, logout } = useAuth()
  const { isMobile } = useSidebar()
  if (!user) {
    return null
  }
  const name = user.member?.fullName?.trim() || user.email
  const email = user.email
  const primaryRole =
    user.clubRoles.find((r) => r.isPrimary)?.roleName ||
    user.clubRoles[0]?.roleName ||
    (user.member ? 'Hội viên' : 'Tài khoản')

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu
          onOpenChange={(open) => {
            onAccountMenuOpenChange?.(open)
          }}
        >
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">
                  {initials(name, email)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="text-sidebar-foreground/70 truncate text-xs">
                  {primaryRole}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg text-xs">
                    {initials(name, email)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            {user.clubRoles.length > 0 && (
              <div className="text-muted-foreground border-b px-2 pb-2 text-xs">
                {user.clubRoles
                  .map((r) => r.departmentName ?? r.roleName)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(' · ')}
              </div>
            )}
            <DropdownMenuSeparator />
            {user.member && (
              <DropdownMenuItem asChild>
                <Link
                  to={`/app/members/${user.id}`}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <IconUserCircle className="size-4" />
                  Hồ sơ tham gia
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to="/app/dashboard" className="flex cursor-pointer items-center gap-2">
                <IconLayoutDashboard className="size-4" />
                Báo cáo theo quý
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={() => void logout()}
            >
              <IconLogout className="size-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
