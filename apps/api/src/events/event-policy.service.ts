import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { isClubLeadership } from '../auth/utils/has-role';

@Injectable()
export class EventPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  isCreator(event: { created_by: bigint }, u: RequestUserPayload): boolean {
    return event.created_by === u.id;
  }

  async isEventManager(eventId: bigint, userId: bigint): Promise<boolean> {
    const row = await this.prisma.event_managers.findFirst({
      where: { event_id: eventId, user_id: userId },
    });
    return !!row;
  }

  async canManageEvent(
    e: { id: bigint; created_by: bigint },
    u: RequestUserPayload,
  ): Promise<boolean> {
    if (isClubLeadership(u.roleCodes)) {
      return true;
    }
    if (this.isCreator(e, u)) {
      return true;
    }
    return this.isEventManager(e.id, u.id);
  }

  /**
   * Duyệt đăng ký, điểm danh, vắng mặt: lãnh đạo CLB hoặc event manager.
   */
  async canReviewEventRegistrations(
    eventId: bigint,
    u: RequestUserPayload,
  ): Promise<boolean> {
    if (isClubLeadership(u.roleCodes)) {
      return true;
    }
    return this.isEventManager(eventId, u.id);
  }

  async assertEventExistsByParam(eventIdParam: string) {
    const id = toBigId(eventIdParam, 'eventId');
    const e = await this.prisma.events.findUnique({ where: { id } });
    if (!e) {
      throw new NotFoundException();
    }
    return e;
  }

  async assertCanManageByParam(eventIdParam: string, u: RequestUserPayload) {
    const e = await this.assertEventExistsByParam(eventIdParam);
    if (!(await this.canManageEvent(e, u))) {
      throw new ForbiddenException();
    }
    return e;
  }

  /**
   * Thành viên xem tiểu ban / lịch họp khi sự kiện đã công bố; team quản lý xem cả bản nháp.
   */
  async assertCanViewEventContent(eventIdParam: string, u: RequestUserPayload) {
    const e = await this.assertEventExistsByParam(eventIdParam);
    if (await this.canManageEvent(e, u)) {
      return e;
    }
    if (['published', 'ongoing', 'ended'].includes(e.status)) {
      return e;
    }
    throw new ForbiddenException();
  }
}
