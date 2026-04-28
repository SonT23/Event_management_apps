import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isClubLeadership } from '../auth/utils/has-role';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { CreatePenaltyDto } from './dto/create-penalty.dto';

@Injectable()
export class PenaltiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    const list = await this.prisma.penalty_rules.findMany({
      where: { is_active: true },
      orderBy: { code: 'asc' },
    });
    return list.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      defaultPoints: r.default_points.toString(),
    }));
  }

  private serializeP(
    p: Prisma.penalty_eventsGetPayload<{
      include: {
        users_penalty_events_user_idTousers: {
          select: { email: true; members: { select: { full_name: true } } };
        };
        events: { select: { title: true } } | null;
        penalty_rules: { select: { code: true; label: true } } | null;
        users_penalty_events_recorded_byTousers: { select: { email: true } };
      };
    }>,
  ) {
    return {
      id: p.id.toString(),
      userId: p.user_id.toString(),
      fullName:
        p.users_penalty_events_user_idTousers?.members?.full_name ?? null,
      email: p.users_penalty_events_user_idTousers?.email,
      eventId: p.event_id?.toString() ?? null,
      eventTitle: p.events?.title ?? null,
      meetingId: p.meeting_id?.toString() ?? null,
      ruleId: p.rule_id,
      ruleCode: p.penalty_rules?.code ?? null,
      ruleLabel: p.penalty_rules?.label ?? null,
      points: p.points.toString(),
      reason: p.reason,
      recordedBy: p.recorded_by.toString(),
      recorderEmail: p.users_penalty_events_recorded_byTousers?.email,
      createdAt: p.created_at,
    };
  }

  async listForUser(u: RequestUserPayload, targetUserId: string | undefined) {
    if (targetUserId) {
      if (!isClubLeadership(u.roleCodes)) {
        throw new ForbiddenException();
      }
    }
    const uid = targetUserId ? toBigId(targetUserId, 'userId') : u.id;
    const list = await this.prisma.penalty_events.findMany({
      where: { user_id: uid },
      include: {
        users_penalty_events_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
        events: { select: { title: true } },
        penalty_rules: { select: { code: true, label: true } },
        users_penalty_events_recorded_byTousers: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return list.map((r) => this.serializeP(r));
  }

  async create(dto: CreatePenaltyDto, u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
    const target = toBigId(dto.userId, 'userId');
    const tu = await this.prisma.users.findUnique({ where: { id: target } });
    if (!tu?.is_active) {
      throw new BadRequestException('Thành viên không tồn tại');
    }
    let points = dto.points;
    if (dto.ruleId != null) {
      const rule = await this.prisma.penalty_rules.findUnique({
        where: { id: dto.ruleId },
      });
      if (!rule || !rule.is_active) {
        throw new BadRequestException('Mã quy tắc trừ điểm không hợp lệ');
      }
      if (points == null) {
        points = Number(rule.default_points);
      }
    }
    if (points == null) {
      throw new BadRequestException('Cần points hoặc ruleId hợp lệ');
    }
    const eventId =
      dto.eventId != null ? toBigId(dto.eventId, 'eventId') : null;
    if (eventId) {
      const e = await this.prisma.events.findUnique({ where: { id: eventId } });
      if (!e) {
        throw new NotFoundException('Sự kiện không tồn tại');
      }
    }
    const meetingId =
      dto.meetingId != null ? toBigId(dto.meetingId, 'meetingId') : null;
    if (meetingId) {
      const m = await this.prisma.event_meetings.findUnique({
        where: { id: meetingId },
      });
      if (!m) {
        throw new NotFoundException('Buổi họp không tồn tại');
      }
      if (eventId && m.event_id !== eventId) {
        throw new BadRequestException(
          'meetingId không cùng sự kiện với eventId',
        );
      }
    }
    const row = await this.prisma.penalty_events.create({
      data: {
        user_id: target,
        event_id: eventId,
        meeting_id: meetingId,
        rule_id: dto.ruleId ?? null,
        points,
        reason: dto.reason?.trim() || null,
        recorded_by: u.id,
      },
      include: {
        users_penalty_events_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
        events: { select: { title: true } },
        penalty_rules: { select: { code: true, label: true } },
        users_penalty_events_recorded_byTousers: { select: { email: true } },
      },
    });
    return this.serializeP(row);
  }
}
