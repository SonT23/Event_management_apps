import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const colClass =
  'flex w-full min-w-0 flex-col gap-1.5 sm:min-w-[13.5rem] md:min-w-[14rem]'

const labelClass =
  'min-h-11 w-full text-sm font-medium leading-tight text-foreground sm:flex sm:items-end'

type Field = {
  id: string
  label: string
  control: ReactNode
}

type Props = {
  /** Gợi ý phía trên (ví dụ quy tắc tự điền giờ) */
  hint?: ReactNode
  start: Field
  end: Field
  className?: string
}

/**
 * Hai ô Bắt đầu / Dự kiến kết thúc dùng chung cho: tạo sự kiện, tạo cuộc họp CLB, buổi họp trong sự kiện.
 */
export function ScheduleDatetimeBlock({ hint, start, end, className }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      {hint != null ? (
        <div className="text-muted-foreground text-xs leading-relaxed">{hint}</div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
        <div className={colClass}>
          <Label htmlFor={start.id} className={labelClass}>
            {start.label}
          </Label>
          {start.control}
        </div>
        <div className={colClass}>
          <Label htmlFor={end.id} className={labelClass}>
            {end.label}
          </Label>
          {end.control}
        </div>
      </div>
    </div>
  )
}

/** Class chung cho DialogContent các form tạo (rộng vừa đủ hai cột thời gian) */
export const createFormDialogClassName =
  'max-h-[min(90dvh,85vh)] overflow-y-auto sm:max-w-2xl'
