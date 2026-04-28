import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function isMissingNotificationsTable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2021' || e.code === 'P2010') {
      return true;
    }
  }
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return m.includes('user_notifications') && m.includes('does not exist');
  }
  return false;
}

@Injectable()
export class UserNotificationsService {
  private readonly log = new Logger(UserNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRegistrationRejected(userId: bigint, eventTitle: string) {
    const title = 'Đăng ký sự kiện bị từ chối';
    const body = `Ban tổ chức đã từ chối đăng ký tham gia của bạn đối với sự kiện «${eventTitle}».`;
    try {
      await this.prisma.user_notifications.create({
        data: {
          user_id: userId,
          kind: 'registration_rejected',
          title,
          body,
        },
      });
    } catch (e) {
      if (isMissingNotificationsTable(e)) {
        this.log.warn(
          'Bỏ qua tạo thông báo: bảng user_notifications chưa có. Chạy: npx prisma migrate deploy (hoặc db push).',
        );
        return { ok: true as const, skipped: true as const };
      }
      throw e;
    }
    return { ok: true as const };
  }

  async listUnread(userId: bigint) {
    try {
      const rows = await this.prisma.user_notifications.findMany({
        where: { user_id: userId, read_at: null },
        orderBy: { created_at: 'desc' },
        take: 30,
      });
      return rows.map((n) => ({
        id: n.id.toString(),
        kind: n.kind,
        title: n.title,
        body: n.body,
        createdAt: n.created_at.toISOString(),
      }));
    } catch (e) {
      if (isMissingNotificationsTable(e)) {
        this.log.warn(
          'unreadNotifications rỗng: bảng user_notifications chưa có. Chạy migration / prisma db push.',
        );
        return [];
      }
      throw e;
    }
  }

  async markRead(userId: bigint, notificationId: bigint) {
    try {
      const n = await this.prisma.user_notifications.findUnique({
        where: { id: notificationId },
      });
      if (!n) {
        throw new NotFoundException();
      }
      if (n.user_id !== userId) {
        throw new ForbiddenException();
      }
      await this.prisma.user_notifications.update({
        where: { id: notificationId },
        data: { read_at: new Date() },
      });
      return { ok: true as const };
    } catch (e) {
      if (isMissingNotificationsTable(e)) {
        return { ok: true as const, skipped: true as const };
      }
      throw e;
    }
  }

  async markAllRead(userId: bigint) {
    try {
      await this.prisma.user_notifications.updateMany({
        where: { user_id: userId, read_at: null },
        data: { read_at: new Date() },
      });
      return { ok: true as const };
    } catch (e) {
      if (isMissingNotificationsTable(e)) {
        return { ok: true as const, skipped: true as const };
      }
      throw e;
    }
  }
}
