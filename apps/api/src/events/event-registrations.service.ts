import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { hashQrToken } from '../common/utils/qr-token';
import { computeCancelNotBefore } from '../common/utils/registration-deadline';
import { EventPolicyService } from './event-policy.service';
import { UserNotificationsService } from '../notifications/user-notifications.service';

@Injectable()
export class EventRegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPolicy: EventPolicyService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  async createRequest(eventIdParam: string, u: RequestUserPayload) {
    const eventId = toBigId(eventIdParam, 'eventId');
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException();
    }
    if (!['published', 'ongoing'].includes(event.status)) {
      throw new BadRequestException('Sự kiện không mở đăng ký');
    }
    const now = new Date();
    if (event.actual_end_at != null || event.status === 'ended') {
      throw new BadRequestException('Sự kiện đã kết thúc');
    }
    if (event.start_at < now && event.status !== 'ongoing') {
      // optional: allow only published with future start - keep lenient
    }
    const exists = await this.prisma.event_registrations.findUnique({
      where: { event_id_user_id: { event_id: eventId, user_id: u.id } },
    });
    if (exists) {
      throw new ConflictException('Bạn đã có bản đăng ký cho sự kiện này');
    }
    const raw = randomBytes(32).toString('hex');
    const hash = hashQrToken(raw);
    const needs = event.requires_approval;
    const status = needs ? 'pending' : 'approved';
    const cancelNotBefore =
      status === 'approved' ? computeCancelNotBefore(event) : null;
    const row = await this.prisma.event_registrations.create({
      data: {
        event_id: eventId,
        user_id: u.id,
        status,
        qr_token_hash: hash,
        qr_issued_at: status === 'approved' ? new Date() : null,
        cancel_not_before: cancelNotBefore,
      },
    });
    return {
      registrationId: row.id.toString(),
      status: row.status,
      qrToken: status === 'approved' ? raw : null,
      message: needs
        ? 'Chờ duyệt; sau khi duyệt bạn sẽ nhận mã QR (gọi lại API chi tiết đăng ký)'
        : 'Đã tham gia; dùng qrToken để hiển thị mã',
    };
  }

  async myRegistrations(u: RequestUserPayload) {
    const list = await this.prisma.event_registrations.findMany({
      where: { user_id: u.id },
      include: {
        events: true,
        event_checkins: { select: { scanned_at: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return list.map((r) => ({
      id: r.id.toString(),
      eventId: r.event_id.toString(),
      eventTitle: r.events.title,
      status: r.status,
      createdAt: r.created_at,
      hasQr: r.status === 'approved',
      checkedInAt: r.event_checkins?.scanned_at ?? null,
      cancelNotBefore: r.cancel_not_before,
      startAt: r.events.start_at,
    }));
  }

  /**
   * Tạo mã QR mới (hash thay thế) — mã cũ hết hiệu lực. Chủ đăng ký, trạng thái approved.
   */
  async rotateQrToken(registrationId: string, u: RequestUserPayload) {
    const id = toBigId(registrationId, 'registrationId');
    const r = await this.prisma.event_registrations.findUnique({
      where: { id },
    });
    if (!r) {
      throw new NotFoundException();
    }
    if (r.user_id !== u.id) {
      throw new ForbiddenException();
    }
    if (r.status !== 'approved') {
      throw new BadRequestException('Chỉ tạo mã QR khi đăng ký đã được duyệt');
    }
    const raw = randomBytes(32).toString('hex');
    const hash = hashQrToken(raw);
    await this.prisma.event_registrations.update({
      where: { id },
      data: {
        qr_token_hash: hash,
        qr_issued_at: new Date(),
        updated_at: new Date(),
      },
    });
    return { ok: true, qrToken: raw };
  }

  async getRegistrationDetail(registrationId: string, u: RequestUserPayload) {
    const id = toBigId(registrationId, 'registrationId');
    const r = await this.prisma.event_registrations.findUnique({
      where: { id },
      include: {
        events: true,
        event_checkins: { select: { scanned_at: true } },
      },
    });
    if (!r) {
      throw new NotFoundException();
    }
    if (
      r.user_id !== u.id &&
      !(await this.eventPolicy.canReviewEventRegistrations(r.event_id, u))
    ) {
      throw new ForbiddenException();
    }
    return {
      id: r.id.toString(),
      eventId: r.event_id.toString(),
      eventTitle: r.events.title,
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
      checkedInAt: r.event_checkins?.scanned_at ?? null,
      cancelNotBefore: r.cancel_not_before,
      startAt: r.events.start_at,
    };
  }

  async listForEvent(eventIdParam: string, u: RequestUserPayload) {
    const eventId = toBigId(eventIdParam, 'eventId');
    if (!(await this.eventPolicy.canReviewEventRegistrations(eventId, u))) {
      throw new ForbiddenException();
    }
    const list = await this.prisma.event_registrations.findMany({
      where: { event_id: eventId },
      include: {
        users_event_registrations_user_idTousers: {
          include: { members: true },
        },
        event_checkins: { select: { scanned_at: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return list.map((r) => ({
      id: r.id.toString(),
      userId: r.user_id.toString(),
      email: r.users_event_registrations_user_idTousers?.email,
      fullName: r.users_event_registrations_user_idTousers?.members?.full_name,
      status: r.status,
      createdAt: r.created_at,
      checkedInAt: r.event_checkins?.scanned_at ?? null,
      cancelNotBefore: r.cancel_not_before,
    }));
  }

  /**
   * Tự hủy đăng ký (không qua bảng participation_cancellations).
   */
  async withdrawSelf(registrationId: string, u: RequestUserPayload) {
    const id = toBigId(registrationId, 'registrationId');
    const r = await this.prisma.event_registrations.findUnique({
      where: { id },
      include: { events: true },
    });
    if (!r) {
      throw new NotFoundException();
    }
    if (r.user_id !== u.id) {
      throw new ForbiddenException();
    }
    if (r.status === 'cancelled' || r.status === 'rejected') {
      throw new BadRequestException('Đăng ký đã kết thúc trạng thái này');
    }
    const ev = r.events;
    const now = new Date();
    if (
      ev.actual_end_at != null ||
      ev.status === 'ended' ||
      ev.status === 'cancelled'
    ) {
      throw new BadRequestException('Sự kiện đã kết thúc hoặc huỷ');
    }
    if (r.status === 'approved') {
      const boundary = r.cancel_not_before ?? ev.start_at;
      if (now.getTime() >= boundary.getTime()) {
        throw new BadRequestException(
          'Đã quá hạn tự huỷ đăng ký theo quy định sự kiện',
        );
      }
    }
    await this.prisma.$transaction([
      this.prisma.event_checkins.deleteMany({ where: { registration_id: id } }),
      this.prisma.event_registrations.update({
        where: { id },
        data: { status: 'cancelled', updated_at: new Date() },
      }),
    ]);
    return { ok: true, id: r.id.toString() };
  }

  async approve(registrationId: string, u: RequestUserPayload) {
    const id = toBigId(registrationId, 'registrationId');
    const r = await this.prisma.event_registrations.findUnique({
      where: { id },
    });
    if (!r) {
      throw new NotFoundException();
    }
    if (!(await this.eventPolicy.canReviewEventRegistrations(r.event_id, u))) {
      throw new ForbiddenException();
    }
    if (r.status !== 'pending') {
      throw new BadRequestException('Không ở trạng thái pending');
    }
    const ev = await this.prisma.events.findUniqueOrThrow({
      where: { id: r.event_id },
    });
    const cancelNotBefore = computeCancelNotBefore(ev);
    const raw = randomBytes(32).toString('hex');
    const hash = hashQrToken(raw);
    await this.prisma.event_registrations.update({
      where: { id },
      data: {
        status: 'approved',
        qr_token_hash: hash,
        qr_issued_at: new Date(),
        decided_by: u.id,
        decided_at: new Date(),
        cancel_not_before: cancelNotBefore,
        updated_at: new Date(),
      },
    });
    return { ok: true, qrToken: raw };
  }

  async reject(registrationId: string, u: RequestUserPayload) {
    const id = toBigId(registrationId, 'registrationId');
    const r = await this.prisma.event_registrations.findUnique({
      where: { id },
    });
    if (!r) {
      throw new NotFoundException();
    }
    if (!(await this.eventPolicy.canReviewEventRegistrations(r.event_id, u))) {
      throw new ForbiddenException();
    }
    if (r.status !== 'pending') {
      throw new BadRequestException();
    }
    const ev = await this.prisma.events.findUniqueOrThrow({
      where: { id: r.event_id },
      select: { title: true },
    });
    await this.prisma.event_registrations.update({
      where: { id },
      data: {
        status: 'rejected',
        decided_by: u.id,
        decided_at: new Date(),
        updated_at: new Date(),
      },
    });
    await this.userNotifications.createRegistrationRejected(r.user_id, ev.title);
    return { ok: true };
  }
}
