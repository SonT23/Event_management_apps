import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isClubLeadership } from '../auth/utils/has-role';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { CreateWarningDto } from './dto/create-warning.dto';

@Injectable()
export class WarningsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(
    w: Prisma.member_warningsGetPayload<{
      include: {
        users_member_warnings_from_user_idTousers: { select: { email: true } };
        users_member_warnings_to_user_idTousers: { select: { email: true } };
      };
    }>,
  ) {
    return {
      id: w.id.toString(),
      toUserId: w.to_user_id.toString(),
      toEmail: w.users_member_warnings_to_user_idTousers?.email,
      fromUserId: w.from_user_id.toString(),
      fromEmail: w.users_member_warnings_from_user_idTousers?.email,
      title: w.title,
      body: w.body,
      isAck: w.is_ack,
      emailSentAt: w.email_sent_at,
      createdAt: w.created_at,
    };
  }

  async listInbox(u: RequestUserPayload) {
    const list = await this.prisma.member_warnings.findMany({
      where: { to_user_id: u.id },
      include: {
        users_member_warnings_from_user_idTousers: { select: { email: true } },
        users_member_warnings_to_user_idTousers: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return list.map((r) => this.serialize(r));
  }

  async listSent(u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
    const list = await this.prisma.member_warnings.findMany({
      where: { from_user_id: u.id },
      include: {
        users_member_warnings_from_user_idTousers: { select: { email: true } },
        users_member_warnings_to_user_idTousers: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return list.map((r) => this.serialize(r));
  }

  async create(dto: CreateWarningDto, u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo/điều hành mới tạo cảnh báo nội bộ',
      );
    }
    const to = toBigId(dto.toUserId, 'toUserId');
    const t = await this.prisma.users.findUnique({ where: { id: to } });
    if (!t) {
      throw new NotFoundException();
    }
    if (to === u.id) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.member_warnings.create({
      data: {
        to_user_id: to,
        from_user_id: u.id,
        title: dto.title,
        body: dto.body?.trim() || null,
      },
      include: {
        users_member_warnings_from_user_idTousers: { select: { email: true } },
        users_member_warnings_to_user_idTousers: { select: { email: true } },
      },
    });
    return this.serialize(row);
  }

  async acknowledge(warningIdParam: string, u: RequestUserPayload) {
    const id = toBigId(warningIdParam, 'warningId');
    const w = await this.prisma.member_warnings.findUnique({ where: { id } });
    if (!w) {
      throw new NotFoundException();
    }
    if (w.to_user_id !== u.id) {
      throw new ForbiddenException();
    }
    const row = await this.prisma.member_warnings.update({
      where: { id },
      data: { is_ack: true },
      include: {
        users_member_warnings_from_user_idTousers: { select: { email: true } },
        users_member_warnings_to_user_idTousers: { select: { email: true } },
      },
    });
    return this.serialize(row);
  }
}
