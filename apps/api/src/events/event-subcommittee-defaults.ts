/**
 * Tiểu ban gợi ý khi tạo sự kiện mới (chỉ thuộc sự kiện đó).
 * Có thể chỉnh / xóa sau khi tạo.
 */
export const DEFAULT_EVENT_SUBCOMMITTEES: {
  name: string;
  code: string;
  maxMembers: number;
}[] = [
  { name: 'Tiểu ban nội dung', code: 'noi_dung', maxMembers: 20 },
  { name: 'Tiểu ban hậu cần & logistics', code: 'hau_can', maxMembers: 30 },
  { name: 'Tiểu ban truyền thông & hình ảnh', code: 'truyen_thong', maxMembers: 15 },
  { name: 'Tiểu ban chương trình / MC', code: 'chuong_trinh', maxMembers: 12 },
];
