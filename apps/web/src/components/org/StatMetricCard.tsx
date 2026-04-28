import type { ComponentType } from 'react'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function StatMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  interactive,
  onOpen,
}: {
  label: string
  value: number
  hint: string
  icon: ComponentType<{ className?: string }>
  interactive?: boolean
  onOpen?: () => void
}) {
  return (
    <Card
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onOpen : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen?.()
              }
            }
          : undefined
      }
      className={
        interactive
          ? '@container/card border-border/60 bg-gradient-to-t from-primary/[0.06] to-card shadow-sm transition hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:from-primary/[0.04] dark:bg-card'
          : '@container/card border-border/60 bg-gradient-to-t from-primary/[0.06] to-card shadow-sm dark:from-primary/[0.04] dark:bg-card'
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardDescription className="line-clamp-2">{label}</CardDescription>
          <Icon className="text-muted-foreground size-4 shrink-0" />
        </div>
        <CardTitle className="text-2xl font-semibold tabular-nums @[200px]/card:text-3xl">
          {value.toLocaleString('vi-VN')}
        </CardTitle>
      </CardHeader>
      <CardFooter className="text-muted-foreground flex flex-col items-start gap-0.5 border-t-0 pt-0 text-xs">
        {hint}
        {interactive && (
          <span className="text-primary/90 font-medium">Nhấn để xem chi tiết</span>
        )}
      </CardFooter>
    </Card>
  )
}
