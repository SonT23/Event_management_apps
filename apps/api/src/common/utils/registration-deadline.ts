/**
 * Mốc: sau thời điểm này thành viên không tự hủy đăng ký được (nếu null = app chỉ chặn sau khi sự kiện bắt đầu, xem nghiệp vụ).
 * Tính từ sự kiện: trước `start` ít nhất `defaultCancelMinutes` phút (số phút trước khi sự kiện diễn ra).
 */
export function computeCancelNotBefore(event: {
  start_at: Date;
  default_cancel_minutes: number | null;
}): Date | null {
  if (event.default_cancel_minutes == null) {
    return null;
  }
  return new Date(
    event.start_at.getTime() - event.default_cancel_minutes * 60_000,
  );
}
