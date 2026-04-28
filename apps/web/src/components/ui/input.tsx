import * as React from "react"

import { cn } from "@/lib/utils"

/** `display:flex` trên input date/time khiến một số trình duyệt (Chrome/Edge) mất/ép biểu tượng lịh góc phải. */
const NATIVE_PICKER_TYPES = new Set([
  "datetime-local",
  "date",
  "time",
  "month",
  "week",
])

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const isNativePicker = type && NATIVE_PICKER_TYPES.has(type)
    const isDateTime = type === "datetime-local"
    return (
      <input
        type={type}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-background text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isNativePicker
            ? isDateTime
              ? "input-native-picker input-native-picker-datetime block pl-3 pr-[5.5rem] leading-normal"
              : "input-native-picker block pl-3 pr-12 leading-normal"
            : "flex px-3 py-2",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
