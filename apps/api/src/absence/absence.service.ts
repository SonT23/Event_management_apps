import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPolicyService } from '../events/event-policy.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { CreateAbsenceRequestDto } from './dto/create-absence-request.dto';
import { DecideAbsenceRequestDto } from './dto/decide-absence-request.dto';

@Injectable()
export class AbsenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventPolicyService,
  ) {}

  private serialize(
    a: Prisma.absence_requestsGetPayload<{
      include: {
        users_absence_requests_user_idTousers: {
          select: { email: true; members: { select: { full_name: true } } };
        };
      };
    }>,
  ) {
    return {
      id: a.id.toString(),
      eventId: a.event_id.toString(),
      userId: a.user_id.toString(),
      fullName: a.users_absence_requests_user_idTousers?.members?.full_name,
      email: a.users_absence_requests_user_idTousers?.email,
      reason: a.reason,
      status: a.status,
      decidedBy: a.decided_by?.toString() ?? null,
      decidedAt: a.decided_at,
      createdAt: a.created_at,
    };
  }

  async create(
    eventIdParam: string,
    dto: CreateAbsenceRequestDto,
    u: RequestUserPayload,
  ) {
    if (!u.members) {
      throw new BadRequestException('Cần hồ sơ hội viên');
    }
    const e = await this.prisma.events.findUnique({
      where: { id: toBigId(eventIdParam, 'eventId') },
    });
    if (!e) {
      throw new NotFoundException();
    }
    if (!['published', 'ongoing'].includes(e.status)) {
      throw new BadRequestException('Sự kiện không mở cho đơn vắng mặt');
    }
    const row = await this.prisma.absence_requests.create({
      data: {
        event_id: e.id,
        user_id: u.id,
        reason: dto.reason.trim(),
      },
      include: {
        users_absence_requests_user_idTousers: {
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
    const list = await this.prisma.absence_requests.findMany({
      where: { event_id: eventId },
      include: {
        users_absence_requests_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return list.map((r) => this.serialize(r));
  }

  async decide(
    idParam: string,
    dto: DecideAbsenceRequestDto,
    u: RequestUserPayload,
  ) {
    const id = toBigId(idParam, 'absenceId');
    const a = await this.prisma.absence_requests.findUnique({ where: { id } });
    if (!a) {
      throw new NotFoundException();
    }
    if (!(await this.policy.canReviewEventRegistrations(a.event_id, u))) {
      throw new ForbiddenException();
    }
    if (a.status !== 'pending') {
      throw new BadRequestException('Đơn đã được xử lý');
    }
    const status = dto.status;
    const row = await this.prisma.absence_requests.update({
      where: { id },
      data: {
        status: status as 'approved' | 'rejected',
        decided_by: u.id,
        decided_at: new Date(),
      },
      include: {
        users_absence_requests_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
      },
    });
    return this.serialize(row);
  }
}
