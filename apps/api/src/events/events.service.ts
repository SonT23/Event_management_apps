import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, events_status } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { isClubLeadership } from '../auth/utils/has-role';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AddManagerDto } from './dto/add-manager.dto';
import { EventPolicyService } from './event-policy.service';
import { DEFAULT_EVENT_SUBCOMMITTEES } from './event-subcommittee-defaults';

const eventDetailInclude = {
  users: { select: { email: true, id: true } },
  event_managers: {
    orderBy: { assigned_at: 'asc' as const },
    include: {
      users_event_managers_user_idTousers: {
        select: { email: true, members: { select: { full_name: true } } },
      },
    },
  },
} satisfies Prisma.eventsInclude;

type EventWithDetail = Prisma.eventsGetPayload<{
  include: typeof eventDetailInclude;
}>;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventPolicyService,
  ) {}

  private async assertCanCreate(u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException('Chỉ lãnh đạo/điều hành mới tạo sự kiện');
    }
  }

  private serialize(e: EventWithDetail) {
    const managers = e.event_managers.map((m) => ({
      userId: m.user_id.toString(),
      fullName:
        m.users_event_managers_user_idTousers?.members?.full_name ?? null,
      email: m.users_event_managers_user_idTousers?.email ?? null,
    }));
    return {
      id: e.id.toString(),
      title: e.title,
      description: e.description,
      startAt: e.start_at,
      expectedEndAt: e.expected_end_at,
      actualEndAt: e.actual_end_at,
      status: e.status,
      requiresApproval: e.requires_approval,
      defaultCancelMinutes: e.default_cancel_minutes,
      createdBy: e.created_by.toString(),
      creatorEmail: e.users?.email,
      managers,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    };
  }

  private async resolveManagerUserIds(
    raw: string[] | undefined,
  ): Promise<bigint[]> {
    if (!raw?.length) {
      return [];
    }
    const seen = new Set<string>();
    const out: bigint[] = [];
    for (const s of raw) {
      const t = s?.trim();
      if (!t || seen.has(t)) {
        continue;
      }
      if (!/^\d+$/.test(t)) {
        throw new BadRequestException(`userId không hợp lệ: ${t}`);
      }
      seen.add(t);
      out.push(toBigId(t, 'userId'));
    }
    if (out.length > 30) {
      throw new BadRequestException('Tối đa 30 quản lý sự kiện');
    }
    const found = await this.prisma.users.findMany({
      where: { id: { in: out }, is_active: true },
      select: { id: true },
    });
    if (found.length !== out.length) {
      throw new BadRequestException(
        'Một hoặc nhiều thành viên được chọn không tồn tại hoặc đã bị vô hiệu',
      );
    }
    return out;
  }

  async create(dto: CreateEventDto, u: RequestUserPayload) {
    await this.assertCanCreate(u);
    const managerIds = await this.resolveManagerUserIds(dto.managerUserIds);
    const row = await this.prisma.$transaction(async (tx) => {
      const ev = await tx.events.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          start_at: new Date(dto.startAt),
          expected_end_at: dto.expectedEndAt ? new Date(dto.expectedEndAt) : null,
          requires_approval: dto.requiresApproval ?? true,
          default_cancel_minutes: dto.defaultCancelMinutes ?? null,
          status: 'draft',
          created_by: u.id,
        },
      });
      for (const uid of managerIds) {
        await tx.event_managers.create({
          data: {
            event_id: ev.id,
            user_id: uid,
            assigned_by: u.id,
          },
        });
      }
      for (const d of DEFAULT_EVENT_SUBCOMMITTEES) {
        await tx.event_subcommittees.create({
          data: {
            event_id: ev.id,
            name: d.name,
            code: d.code,
            max_members: d.maxMembers,
            created_by: u.id,
          },
        });
      }
      return tx.events.findUniqueOrThrow({
        where: { id: ev.id },
        include: eventDetailInclude,
      });
    });
    return this.serialize(row);
  }

  listWhere(u: RequestUserPayload): Prisma.eventsWhereInput {
    if (isClubLeadership(u.roleCodes)) {
      return {};
    }
    return {
      OR: [
        { status: { in: ['published', 'ongoing', 'ended'] } },
        { created_by: u.id },
      ],
    };
  }

  async list(
    u: RequestUserPayload,
    q: { status?: string; page: number; pageSize: number },
  ) {
    const where: Prisma.eventsWhereInput = this.listWhere(u);
    if (q.status) {
      where.status = q.status as events_status;
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.events.count({ where }),
      this.prisma.events.findMany({
        where,
        include: eventDetailInclude,
        orderBy: { start_at: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      page: q.page,
      pageSize: q.pageSize,
      total,
      items: rows.map((e) => this.serialize(e)),
    };
  }

  /** Sự kiện mà thành viên đang được phân công quản lý (bảng event_managers). */
  async listManagedByCurrentUser(u: RequestUserPayload) {
    const rows = await this.prisma.events.findMany({
      where: {
        event_managers: { some: { user_id: u.id } },
      },
      include: eventDetailInclude,
      orderBy: { start_at: 'desc' },
    });
    return { items: rows.map((e) => this.serialize(e)) };
  }

  async getOne(idParam: string, u: RequestUserPayload) {
    const id = toBigId(idParam, 'eventId');
    const e = await this.prisma.events.findUnique({
      where: { id },
      include: eventDetailInclude,
    });
    if (!e) {
      throw new NotFoundException();
    }
    if (e.status === 'draft') {
      const isMgr = await this.policy.isEventManager(id, u.id);
      if (
        !isClubLeadership(u.roleCodes) &&
        !this.policy.isCreator(e, u) &&
        !isMgr
      ) {
        throw new NotFoundException();
      }
    } else if (!isClubLeadership(u.roleCodes) && !this.policy.isCreator(e, u)) {
      if (!['published', 'ongoing', 'ended'].includes(e.status)) {
        throw new NotFoundException();
      }
    }
    return this.serialize(e);
  }

  async update(idParam: string, dto: UpdateEventDto, u: RequestUserPayload) {
    const id = toBigId(idParam, 'eventId');
    const e = await this.prisma.events.findUnique({ where: { id } });
    if (!e) {
      throw new NotFoundException();
    }
    if (!(await this.policy.canManageEvent(e, u))) {
      throw new ForbiddenException();
    }
    const data: Prisma.eventsUpdateInput = { updated_at: new Date() };
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.startAt !== undefined) {
      data.start_at = new Date(dto.startAt);
    }
    if (dto.expectedEndAt !== undefined) {
      data.expected_end_at = dto.expectedEndAt
        ? new Date(dto.expectedEndAt)
        : null;
    }
    if (dto.status !== undefined) {
      if (isClubLeadership(u.roleCodes)) {
        data.status = dto.status;
      } else if (this.policy.isCreator(e, u)) {
        if (!['draft', 'published', 'cancelled'].includes(dto.status)) {
          throw new ForbiddenException();
        }
        data.status = dto.status;
      } else {
        throw new ForbiddenException();
      }
    }
    if (dto.requiresApproval !== undefined) {
      data.requires_approval = dto.requiresApproval;
    }
    if (dto.defaultCancelMinutes !== undefined) {
      data.default_cancel_minutes = dto.defaultCancelMinutes;
    }
    const row = await this.prisma.events.update({
      where: { id },
      data,
      include: eventDetailInclude,
    });
    return this.serialize(row);
  }

  async publish(idParam: string, u: RequestUserPayload) {
    return this.update(idParam, { status: 'published' }, u);
  }

  async end(idParam: string, u: RequestUserPayload) {
    const id = toBigId(idParam, 'eventId');
    const e = await this.prisma.events.findUnique({ where: { id } });
    if (!e) {
      throw new NotFoundException();
    }
    if (
      !isClubLeadership(u.roleCodes) &&
      !(await this.policy.isEventManager(id, u.id)) &&
      !this.policy.isCreator(e, u)
    ) {
      throw new ForbiddenException();
    }
    const now = new Date();
    if (e.start_at > now) {
      throw new BadRequestException(
        'Sự kiện chưa bắt đầu, không bấm kết thúc theo nghiệp vụ tối thiểu (kiểm tra ở app nếu cần mềm hơn)',
      );
    }
    const row = await this.prisma.events.update({
      where: { id },
      data: { status: 'ended', actual_end_at: now, updated_at: now },
      include: eventDetailInclude,
    });
    return this.serialize(row);
  }

  /**
   * Xóa sự kiện (cascade DB). Chỉ BCH, hoặc người tạo khi sự kiện còn nháp.
   */
  async remove(idParam: string, u: RequestUserPayload) {
    const id = toBigId(idParam, 'eventId');
    const e = await this.prisma.events.findUnique({ where: { id } });
    if (!e) {
      throw new NotFoundException();
    }
    const creator = this.policy.isCreator(e, u);
    if (!isClubLeadership(u.roleCodes) && !(creator && e.status === 'draft')) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo CLB, hoặc người tạo khi sự kiện còn nháp, mới xóa được',
      );
    }
    await this.prisma.events.delete({ where: { id } });
    return { ok: true, deletedEventId: id.toString() };
  }

  async addManager(idParam: string, dto: AddManagerDto, u: RequestUserPayload) {
    const id = toBigId(idParam, 'eventId');
    const e = await this.prisma.events.findUnique({ where: { id } });
    if (!e) {
      throw new NotFoundException();
    }
    if (!isClubLeadership(u.roleCodes) && !this.policy.isCreator(e, u)) {
      throw new ForbiddenException();
    }
    const targetId = toBigId(dto.userId, 'userId');
    if (targetId === u.id) {
      // cho phép tự thêm: skip
    }
    const t = await this.prisma.users.findUnique({ where: { id: targetId } });
    if (!t?.is_active) {
      throw new BadRequestException('User không tồn tại hoặc bị vô hiệu');
    }
    await this.prisma.event_managers.upsert({
      where: { event_id_user_id: { event_id: id, user_id: targetId } },
      create: {
        event_id: id,
        user_id: targetId,
        assigned_by: u.id,
      },
      update: { assigned_by: u.id, assigned_at: new Date() },
    });
    return { ok: true, eventId: id.toString(), userId: targetId.toString() };
  }

  async removeManager(
    idParam: string,
    userIdParam: string,
    u: RequestUserPayload,
  ) {
    const id = toBigId(idParam, 'eventId');
    const e = await this.prisma.events.findUnique({ where: { id } });
    if (!e) {
      throw new NotFoundException();
    }
    if (!isClubLeadership(u.roleCodes) && !this.policy.isCreator(e, u)) {
      throw new ForbiddenException();
    }
    const targetId = toBigId(userIdParam, 'userId');
    const m = await this.prisma.event_managers.findFirst({
      where: { event_id: id, user_id: targetId },
    });
    if (!m) {
      throw new NotFoundException();
    }
    await this.prisma.event_managers.delete({ where: { id: m.id } });
    return { ok: true, eventId: id.toString(), userId: targetId.toString() };
  }

  async listManagers(idParam: string, u: RequestUserPayload) {
    const id = toBigId(idParam, 'eventId');
    const e = await this.prisma.events.findUnique({ where: { id } });
    if (!e) {
      throw new NotFoundException();
    }
    if (
      !isClubLeadership(u.roleCodes) &&
      !(await this.policy.canManageEvent(e, u))
    ) {
      throw new ForbiddenException();
    }
    const list = await this.prisma.event_managers.findMany({
      where: { event_id: id },
      include: {
        users_event_managers_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
      },
    });
    return list.map((m) => ({
      id: m.id.toString(),
      userId: m.user_id.toString(),
      fullName:
        m.users_event_managers_user_idTousers?.members?.full_name ?? null,
      email: m.users_event_managers_user_idTousers?.email ?? null,
      assignedAt: m.assigned_at,
    }));
  }
}
