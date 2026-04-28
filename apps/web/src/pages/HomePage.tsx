import { Link } from 'react-router-dom'
import { IconCalendarEvent, IconLock, IconUsers } from '@tabler/icons-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const features = [
  {
    title: 'Sự kiện & đăng ký',
    desc: 'Theo dõi sự kiện đã công bố, đăng ký tham gia, duyệt và mã QR check-in từ dữ liệu events / event_registrations.',
    icon: IconCalendarEvent,
  },
  {
    title: 'Hội viên & phân quyền',
    desc: 'BCH xem tổng quan từ org/summary, danh sách hội viên; người dùng thường xem bản thân qua đăng ký sự kiện.',
    icon: IconUsers,
  },
  {
    title: 'Bảo mật',
    desc: 'Đăng nhập bằng HTTP-only cookie (JWT) — cùng origin với API qua proxy dev.',
    icon: IconLock,
  },
] as const

export function HomePage() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center p-8 text-sm">
        Đang tải…
      </div>
    )
  }
  if (user) {
    return (
      <div className="from-background to-muted/40 flex min-h-svh flex-col items-center justify-center bg-gradient-to-b px-4 py-12">
        <div className="w-full max-w-lg space-y-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Xin chào, {user.member?.fullName ?? user.email}
          </h1>
          <p className="text-muted-foreground text-pretty text-sm">
            Bạn đã đăng nhập. Vào bảng điều khiển để xem số liệu (theo quyền) và
            đăng ký sự kiện.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/app/dashboard">Bảng điều khiển</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/events">Sự kiện</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="from-background to-muted/50 flex min-h-svh flex-col bg-gradient-to-b">
      <div className="border-border/60 mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-primary font-medium">Cổng nội bộ</p>
          <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Media Club
          </h1>
          <p className="text-muted-foreground mt-3 text-pretty text-sm md:text-base">
            Một ứng dụng theo bố cục dashboard (shadcn): quản lý sự kiện, hội
            viên, điểm danh QR — số liệu đồng bộ với cơ sở dữ liệu thông qua API
            NestJS.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button asChild size="lg">
              <Link to="/login">Đăng nhập</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/register">Tạo tài khoản</Link>
            </Button>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <Card
                key={f.title}
                className="bg-card/80 border-border/60 flex flex-col shadow-sm backdrop-blur"
              >
                <CardHeader>
                  <div className="text-muted-foreground mb-1 flex h-9 w-9 items-center justify-center rounded-lg border bg-gradient-to-b from-primary/10 to-transparent">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription className="text-pretty text-xs leading-relaxed">
                    {f.desc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto" />
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
