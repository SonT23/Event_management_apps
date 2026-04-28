/** Nhãn hiển thị cho trạng thái từ DB (sự kiện, đăng ký) */
const registration: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
}

const event: Record<string, string> = {
  draft: 'Bản nháp',
  published: 'Đã công bố',
  ongoing: 'Đang diễn ra',
  ended: 'Đã kết thúc',
  cancelled: 'Đã hủy',
}

export function registrationStatusLabel(code: string) {
  return registration[code] ?? code
}

export function eventStatusLabel(code: string) {
  return event[code] ?? code
}

export function membershipStatusLabel(code: string) {
  if (code === 'active') {
    return 'Hoạt động'
  }
  if (code === 'inactive') {
    return 'Không hoạt động'
  }
  return code
}
