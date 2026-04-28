import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPolicyService } from '../events/event-policy.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { AddSubcommitteeMemberDto } from './dto/add-subcommittee-member.dto';
import {
  CreateSubcommitteeDto,
  UpdateSubcommitteeDto,
} from './dto/create-subcommittee.dto';

@Injectable()
export class SubcommitteesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventPolicyService,
  ) {}

  private serialize(
    s: Prisma.event_subcommitteesGetPayload<{
      include: {
        event_subcommittee_members: {
          include: {
            users_event_subcommittee_members_user_idTousers: {
              select: {
                email: true;
                id: true;
                members: { select: { full_name: true } };
              };
            };
          };
        };
      };
    }>,
  ) {
    return {
      id: s.id.toString(),
      eventId: s.event_id.toString(),
      name: s.name,
      code: s.code,
      maxMembers: s.max_members,
      memberCount: s.event_subcommittee_members.length,
      createdBy: s.created_by.toString(),
      createdAt: s.created_at,
      members: s.event_subcommittee_members.map((m) => ({
        id: m.id.toString(),
        userId: m.user_id.toString(),
        fullName:
          m.users_event_subcommittee_members_user_idTousers?.members
            ?.full_name ?? null,
        email: m.users_event_subcommittee_members_user_idTousers?.email,
        assignedAt: m.assigned_at,
      })),
    };
  }

  async listForEvent(eventIdParam: string, u: RequestUserPayload) {
    const e = await this.policy.assertCanViewEventContent(eventIdParam, u);
    const id = e.id;
    const rows = await this.prisma.event_subcommittees.findMany({
      where: { event_id: id },
      include: {
        event_subcommittee_members: {
          include: {
            users_event_subcommittee_members_user_idTousers: {
              select: {
                email: true,
                id: true,
                members: { select: { full_name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async create(
    eventIdParam: string,
    dto: CreateSubcommitteeDto,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const row = await this.prisma.event_subcommittees.create({
      data: {
        event_id: e.id,
        name: dto.name,
        code: dto.code?.trim() || null,
        max_members: dto.maxMembers ?? null,
        created_by: u.id,
      },
      include: {
        event_subcommittee_members: {
          include: {
            users_event_subcommittee_members_user_idTousers: {
              select: {
                email: true,
                id: true,
                members: { select: { full_name: true } },
              },
            },
          },
        },
      },
    });
    return this.serialize(row);
  }

  private async getSubOrThrow(eventId: bigint, subId: bigint) {
    const s = await this.prisma.event_subcommittees.findFirst({
      where: { id: subId, event_id: eventId },
      include: {
        event_subcommittee_members: {
          include: {
            users_event_subcommittee_members_user_idTousers: {
              select: {
                email: true,
                id: true,
                members: { select: { full_name: true } },
              },
            },
          },
        },
      },
    });
    if (!s) {
      throw new NotFoundException();
    }
    return s;
  }

  async getOne(
    eventIdParam: string,
    subIdParam: string,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanViewEventContent(eventIdParam, u);
    const subId = toBigId(subIdParam, 'subcommitteeId');
    return this.serialize(await this.getSubOrThrow(e.id, subId));
  }

  async update(
    eventIdParam: string,
    subIdParam: string,
    dto: UpdateSubcommitteeDto,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const subId = toBigId(subIdParam, 'subcommitteeId');
    const existing = await this.getSubOrThrow(e.id, subId);
    const data: Prisma.event_subcommitteesUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.code !== undefined) {
      data.code = dto.code?.trim() || null;
    }
    if (dto.clearMaxMembers) {
      data.max_members = null;
    } else if (dto.maxMembers !== undefined) {
      if (dto.maxMembers < existing.event_subcommittee_members.length) {
        throw new BadRequestException(
          `Giới hạn phải ≥ ${existing.event_subcommittee_members.length} (số thành viên hiện tại)`,
        );
      }
      data.max_members = dto.maxMembers;
    }
    const row = await this.prisma.event_subcommittees.update({
      where: { id: existing.id },
      data,
      include: {
        event_subcommittee_members: {
          include: {
            users_event_subcommittee_members_user_idTousers: {
              select: {
                email: true,
                id: true,
                members: { select: { full_name: true } },
              },
            },
          },
        },
      },
    });
    return this.serialize(row);
  }

  async remove(
    eventIdParam: string,
    subIdParam: string,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const subId = toBigId(subIdParam, 'subcommitteeId');
    const existing = await this.prisma.event_subcommittees.findFirst({
      where: { id: subId, event_id: e.id },
    });
    if (!existing) {
      throw new NotFoundException();
    }
    await this.prisma.event_subcommittees.delete({ where: { id: subId } });
    return { ok: true, id: subId.toString() };
  }

  async addMember(
    eventIdParam: string,
    subIdParam: string,
    dto: AddSubcommitteeMemberDto,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const subId = toBigId(subIdParam, 'subcommitteeId');
    const sub = await this.getSubOrThrow(e.id, subId);
    const target = toBigId(dto.userId, 'userId');
    const t = await this.prisma.users.findUnique({ where: { id: target } });
    if (!t?.is_active) {
      throw new BadRequestException('Tài khoản không hợp lệ hoặc đã ngưng');
    }
    const n = sub.event_subcommittee_members.length;
    const cap = sub.max_members;
    if (cap != null && n >= cap) {
      throw new BadRequestException(
        `Tiểu ban đã đủ ${cap} người (theo giới hạn)`,
      );
    }
    try {
      await this.prisma.event_subcommittee_members.create({
        data: {
          subcommittee_id: sub.id,
          user_id: target,
          assigned_by: u.id,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Thành viên đã có trong ban');
      }
      throw err;
    }
    return this.getOne(eventIdParam, subIdParam, u);
  }

  async removeMember(
    eventIdParam: string,
    subIdParam: string,
    userIdParam: string,
    u: RequestUserPayload,
  ) {
    await this.policy.assertCanManageByParam(eventIdParam, u);
    const e = await this.policy.assertEventExistsByParam(eventIdParam);
    const subId = toBigId(subIdParam, 'subcommitteeId');
    const sub = await this.getSubOrThrow(e.id, subId);
    const target = toBigId(userIdParam, 'userId');
    const m = await this.prisma.event_subcommittee_members.findFirst({
      where: { subcommittee_id: sub.id, user_id: target },
    });
    if (!m) {
      throw new NotFoundException();
    }
    await this.prisma.event_subcommittee_members.delete({
      where: { id: m.id },
    });
    return { ok: true, userId: target.toString() };
  }
}
