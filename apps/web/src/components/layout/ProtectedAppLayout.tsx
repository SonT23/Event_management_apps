import type { CSSProperties } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthNotificationBanner } from '@/components/layout/AuthNotificationBanner'
import { MCHeader } from '@/components/layout/MCHeader'
import { MCSidebar } from '@/components/layout/MCSidebarNav'
import { SkipLink } from '@/components/layout/SkipLink'
import { Skeleton } from '@/components/ui/skeleton'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export function ProtectedAppLayout() {
  const { user, loading } = useAuth()
  const from = useLocation()
  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-3xl space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: from.pathname }} />
  }
  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          '--sidebar-width': '16rem',
          '--header-height': '3rem',
        } as CSSProperties
      }
    >
      <SkipLink />
      <MCSidebar />
      <SidebarInset>
        <AuthNotificationBanner />
        <MCHeader />
        <div
          id="main"
          className="flex min-h-0 flex-1 flex-col"
          tabIndex={-1}
        >
          <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
