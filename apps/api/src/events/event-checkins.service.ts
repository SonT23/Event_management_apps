import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPolicyService } from './event-policy.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { hashQrToken } from '../common/utils/qr-token';
import { CheckInByQrDto } from './dto/check-in-by-qr.dto';

@Injectable()
export class EventCheckinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventPolicyService,
  ) {}

  private assertEventAllowsCheckin(e: {
    status: string;
    actual_end_at: Date | null;
  }) {
    if (!['published', 'ongoing'].includes(e.status)) {
      throw new BadRequestException(
        'Sự kiện không mở check-in (trạng thái sự kiện)',
      );
    }
    if (e.actual_end_at != null || e.status === 'ended') {
      throw new BadRequestException('Sự kiện đã kết thúc, không check-in thêm');
    }
  }

  async scan(eventIdParam: string, dto: CheckInByQrDto, u: RequestUserPayload) {
    const eventId = toBigId(eventIdParam, 'eventId');
    if (!(await this.policy.canReviewEventRegistrations(eventId, u))) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo CLB / quản lý sự kiện mới thực hiện check-in',
      );
    }
    const e = await this.prisma.events.findUnique({ where: { id: eventId } });
    if (!e) {
      throw new NotFoundException();
    }
    this.assertEventAllowsCheckin(e);
    const hash = hashQrToken(dto.qrToken.trim());
    const reg = await this.prisma.event_registrations.findFirst({
      where: { event_id: eventId, qr_token_hash: hash },
      include: {
        users_event_registrations_user_idTousers: {
          select: { email: true, members: { select: { full_name: true } } },
        },
      },
    });
    if (!reg) {
      throw new NotFoundException('Mã QR không hợp lệ với sự kiện này');
    }
    if (reg.status !== 'approved') {
      throw new BadRequestException('Đăng ký chưa duyệt, không thể check-in');
    }
    try {
      const row = await this.prisma.event_checkins.create({
        data: {
          event_id: eventId,
          registration_id: reg.id,
          scanned_by: u.id,
          scanned_at: new Date(),
          note: dto.note?.trim() || null,
        },
        include: {
          users: { select: { members: { select: { full_name: true } } } },
        },
      });
      return {
        ok: true,
        checkInId: row.id.toString(),
        eventId: eventId.toString(),
        registrationId: reg.id.toString(),
        userId: reg.user_id.toString(),
        fullName:
          reg.users_event_registrations_user_idTousers?.members?.full_name ??
          null,
        email: reg.users_event_registrations_user_idTousers?.email,
        scannedAt: row.scanned_at,
        scannedByName: row.users?.members?.full_name ?? null,
        note: row.note,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Thành viên này đã check-in rồi');
      }
      throw err;
    }
  }

  private serializeListRow(
    c: Prisma.event_checkinsGetPayload<{
      include: {
        event_registrations: {
          include: {
            users_event_registrations_user_idTousers: {
              select: { email: true; members: { select: { full_name: true } } };
            };
          };
        };
        users: { select: { members: { select: { full_name: true } } } };
      };
    }>,
  ) {
    return {
      id: c.id.toString(),
      registrationId: c.registration_id.toString(),
      userId: c.event_registrations.user_id.toString(),
      fullName:
        c.event_registrations?.users_event_registrations_user_idTousers?.members
          ?.full_name ?? null,
      email:
        c.event_registrations?.users_event_registrations_user_idTousers?.email,
      scannedAt: c.scanned_at,
      scannedBy: c.scanned_by.toString(),
      scannerName: c.users?.members?.full_name ?? null,
      note: c.note,
    };
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
    const rows = await this.prisma.event_checkins.findMany({
      where: { event_id: eventId },
      include: {
        event_registrations: {
          include: {
            users_event_registrations_user_idTousers: {
              select: { email: true, members: { select: { full_name: true } } },
            },
          },
        },
        users: { select: { members: { select: { full_name: true } } } },
      },
      orderBy: { scanned_at: 'asc' },
    });
    return {
      eventId: eventId.toString(),
      eventTitle: e.title,
      total: rows.length,
      items: rows.map((r) => this.serializeListRow(r)),
    };
  }
}
