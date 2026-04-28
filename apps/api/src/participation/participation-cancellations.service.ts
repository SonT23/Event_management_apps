import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPolicyService } from '../events/event-policy.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { CreateParticipationCancellationDto } from './dto/create-participation-cancellation.dto';
import { DecideParticipationCancellationDto } from './dto/decide-participation-cancellation.dto';

@Injectable()
export class ParticipationCancellationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventPolicyService,
  ) {}

  private serialize(
    p: Prisma.participation_cancellationsGetPayload<{
      include: {
        users_participation_cancellations_user_idTousers: {
          select: { email: true; members: { select: { full_name: true } } };
        };
      };
    }>,
  ) {
    return {
      id: p.id.toString(),
      eventId: p.event_id.toString(),
      userId: p.user_id.toString(),
      fullName:
        p.users_participation_cancellations_user_idTousers?.members?.full_name,
      email: p.users_participation_cancellations_user_idTousers?.email,
      reason: p.reason,
      status: p.status,
      decidedBy: p.decided_by?.toString() ?? null,
      decidedAt: p.decided_at,
      createdAt: p.created_at,
    };
  }

  async create(
    eventIdParam: string,
    dto: CreateParticipationCancellationDto,
    u: RequestUserPayload,
  ) {
    if (!u.members) {
      throw new BadRequestException('Cần hồ sơ hội viên');
    }
    const eventId = toBigId(eventIdParam, 'eventId');
    const reg = await this.prisma.event_registrations.findUnique({
      where: { event_id_user_id: { event_id: eventId, user_id: u.id } },
    });
    if (!reg) {
      throw new BadRequestException('Bạn chưa đăng ký sự kiện này');
    }
    if (reg.status === 'cancelled' || reg.status === 'rejected') {
      throw new BadRequestException('Đăng ký đã bị từ chối hoặc hủy');
    }
    const dup = await this.prisma.participation_cancellations.findFirst({
      where: { event_id: eventId, user_id: u.id, status: 'pending' },
    });
    if (dup) {
      throw new ConflictException('Bạn đã có đơn hủy tham gia đang chờ duyệt');
    }
    const e = await this.prisma.events.findUnique({ where: { id: eventId } });
    if (!e) {
      throw new NotFoundException();
    }
    if (
      !['published', 'ongoing'].includes(e.status) ||
      e.actual_end_at != null
    ) {
      throw new BadRequestException(
        'Sự kiện không còn nhận yêu cầu hủy tham gia',
      );
    }
    const row = await this.prisma.participation_cancellations.create({
      data: {
        event_id: eventId,
        user_id: u.id,
        reason: dto.reason?.trim() || null,
        status: 'pending',
      },
      include: {
        users_participation_cancellations_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
      },
    });
    return this.serialize(row);
  }

  async listForEvent(eventIdParam: string, u: RequestUserPayload) {
    const eventId = toBigId(eventIdParam, 'eventId');
    if (!(await this.policy.canReviewEventRegistrations(eventId, u))) {
      throw new ForbiddenException();
    }
    const e = await this.prisma.events.findUnique({ where: { id: eventId } });
    if (!e) {
      throw new NotFoundException();
    }
    const list = await this.prisma.participation_cancellations.findMany({
      where: { event_id: eventId },
      include: {
        users_participation_cancellations_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return {
      eventId: eventId.toString(),
      eventTitle: e.title,
      total: list.length,
      items: list.map((r) => this.serialize(r)),
    };
  }

  async decide(
    idParam: string,
    dto: DecideParticipationCancellationDto,
    u: RequestUserPayload,
  ) {
    const id = toBigId(idParam, 'participationCancellationId');
    const row = await this.prisma.participation_cancellations.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException();
    }
    if (!(await this.policy.canReviewEventRegistrations(row.event_id, u))) {
      throw new ForbiddenException();
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('Đơn đã xử lý');
    }
    if (dto.status === 'rejected') {
      const p = await this.prisma.participation_cancellations.update({
        where: { id },
        data: {
          status: 'rejected' as const,
          decided_by: u.id,
          decided_at: new Date(),
        },
        include: {
          users_participation_cancellations_user_idTousers: {
            select: { email: true, members: { select: { full_name: true } } },
          },
        },
      });
      return this.serialize(p);
    }
    const reg = await this.prisma.event_registrations.findUnique({
      where: {
        event_id_user_id: { event_id: row.event_id, user_id: row.user_id },
      },
    });
    if (!reg || reg.status === 'cancelled') {
      await this.prisma.participation_cancellations.update({
        where: { id },
        data: {
          status: 'rejected' as const,
          decided_by: u.id,
          decided_at: new Date(),
        },
      });
      throw new BadRequestException(
        'Đăng ký đã hủy, không thể chấp nhận hủy tham gia',
      );
    }
    await this.prisma.$transaction([
      this.prisma.event_checkins.deleteMany({
        where: { registration_id: reg.id },
      }),
      this.prisma.event_registrations.update({
        where: { id: reg.id },
        data: { status: 'cancelled', updated_at: new Date() },
      }),
      this.prisma.participation_cancellations.update({
        where: { id },
        data: {
          status: 'approved' as const,
          decided_by: u.id,
          decided_at: new Date(),
        },
      }),
    ]);
    const p = await this.prisma.participation_cancellations.findUniqueOrThrow({
      where: { id },
      include: {
        users_participation_cancellations_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
      },
    });
    return this.serialize(p);
  }
}
