import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gỡ bản ghi đăng ký vẫn pending khi sự kiện (cần duyệt) đã tới mốc bắt đầu
 * mà chưa ai duyệt / từ chối.
 */
@Injectable()
export class PendingRegistrationCleanupService {
  private readonly log = new Logger(PendingRegistrationCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run() {
    const now = new Date();
    const r = await this.prisma.event_registrations.deleteMany({
      where: {
        status: 'pending',
        events: {
          start_at: { lte: now },
          requires_approval: true,
        },
      },
    });
    if (r.count > 0) {
      this.log.log(`Đã gỡ ${r.count} đăng ký pending hết hạn duyệt (đã tới giờ bắt đầu sự kiện)`);
    }
  }
}
