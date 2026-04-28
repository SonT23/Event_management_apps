import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, meeting_attendances_result } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPolicyService } from '../events/event-policy.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { CheckInByQrDto } from '../events/dto/check-in-by-qr.dto';
import {
  CreateEventMeetingDto,
  UpdateEventMeetingDto,
} from './dto/create-event-meeting.dto';
import { RecordMeetingAttendanceDto } from './dto/record-meeting-attendance.dto';
import { hashQrToken } from '../common/utils/qr-token';

const MEETING_SCAN_WINDOW_MS = 30 * 60 * 1_000;

/** Tránh lệch đồng hồ client/server (vài giây). */
const MEETING_FUTURE_SKEW_MS = 2_000;

@Injectable()
export class EventMeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventPolicyService,
  ) {}

  /** Mở quét = bắt đầu buổi; đóng quét = 30 phút sau. */
  private scanWindowFromStart(start: Date) {
    const open = new Date(start.getTime());
    const close = new Date(start.getTime() + MEETING_SCAN_WINDOW_MS);
    return { open, close };
  }

  private assertPlannedEndAfterScanWindow(
    plannedEnd: Date,
    scanClose: Date,
  ) {
    if (plannedEnd.getTime() <= scanClose.getTime()) {
      throw new BadRequestException(
        'Thời gian dự kiến kết thúc phải sau 30 phút kể từ lúc bắt đầu (sau thời điểm đóng quét)',
      );
    }
  }

  /** Mốc bắt đầu và dự kiến kết thúc phải nằm sau thời điểm hiện tại (lịch tương lai). */
  private assertMeetingNotInThePast(start: Date, end: Date) {
    const t = Date.now() - MEETING_FUTURE_SKEW_MS;
    if (start.getTime() < t || end.getTime() < t) {
      throw new BadRequestException(
        'Thời điểm bắt đầu và dự kiến kết thúc phải sau thời điểm hiện tại',
      );
    }
  }

  /** Cả khoảng thời gian buổi (và tùy chọn khung quét) nằm trước thời điểm bắt đầu sự kiện. */
  private assertMeetingBeforeEventStart(
    eventStart: Date,
    start: Date,
    end: Date,
    scanOpen: Date | null,
    scanClose: Date | null,
  ) {
    if (end.getTime() >= eventStart.getTime() || start.getTime() >= eventStart.getTime()) {
      throw new BadRequestException(
        'Thời gian bắt đầu và kết thúc buổi họp phải nằm trước thời điểm bắt đầu sự kiện',
      );
    }
    if (scanOpen && scanOpen.getTime() >= eventStart.getTime()) {
      throw new BadRequestException(
        'Mở quét phải trước thời điểm bắt đầu sự kiện',
      );
    }
    if (scanClose && scanClose.getTime() >= eventStart.getTime()) {
      throw new BadRequestException(
        'Đóng quét phải trước thời điểm bắt đầu sự kiện',
      );
    }
  }

  private serialize(
    m: Prisma.event_meetingsGetPayload<{
      include: { users: { select: { email: true; id: true } } };
    }>,
  ) {
    const official = m.actual_end_at ?? m.end_at;
    return {
      id: m.id.toString(),
      eventId: m.event_id.toString(),
      title: m.title,
      reason: m.reason,
      status: m.status,
      cancelledAt: m.cancelled_at,
      meetingType: m.meeting_type,
      startAt: m.start_at,
      /** Dự kiến kết thúc (cùng trường lưu end_at) */
      endAt: m.end_at,
      actualEndAt: m.actual_end_at,
      officialEndAt: official,
      scanOpenAt: m.scan_open_at,
      scanCloseAt: m.scan_close_at,
      createdBy: m.created_by.toString(),
      creatorEmail: m.users?.email,
      createdAt: m.created_at,
    };
  }

  private windowBounds(m: {
    start_at: Date;
    end_at: Date;
    scan_open_at: Date | null;
    scan_close_at: Date | null;
  }): { open: Date; close: Date } {
    return {
      open: m.scan_open_at ?? m.start_at,
      close: m.scan_close_at ?? m.end_at,
    };
  }

  private computeResult(
    meeting: {
      start_at: Date;
      end_at: Date;
      scan_open_at: Date | null;
      scan_close_at: Date | null;
    },
    scannedAt: Date,
  ): { result: meeting_attendances_result; minutesAfterStart: number } {
    const { open, close } = this.windowBounds(meeting);
    const t = scannedAt.getTime();
    if (t < open.getTime() || t > close.getTime()) {
      return { result: 'out_of_window' as const, minutesAfterStart: 0 };
    }
    const ms = t - meeting.start_at.getTime();
    const minutesAfterStart = Math.floor(ms / 60_000);
    const result: meeting_attendances_result =
      minutesAfterStart > 0 ? 'late' : 'on_time';
    return { result, minutesAfterStart: Math.max(0, minutesAfterStart) };
  }

  async listForEvent(eventIdParam: string, u: RequestUserPayload) {
    const e = await this.policy.assertCanViewEventContent(eventIdParam, u);
    const list = await this.prisma.event_meetings.findMany({
      where: { event_id: e.id },
      include: { users: { select: { email: true, id: true } } },
      orderBy: { start_at: 'asc' },
    });
    return [...list]
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'scheduled' ? -1 : 1;
        }
        return a.start_at.getTime() - b.start_at.getTime();
      })
      .map((m) => this.serialize(m));
  }

  async create(
    eventIdParam: string,
    dto: CreateEventMeetingDto,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (end <= start) {
      throw new BadRequestException('endAt phải sau startAt');
    }
    this.assertMeetingNotInThePast(start, end);
    const { open: so, close: sc } = this.scanWindowFromStart(start);
    this.assertPlannedEndAfterScanWindow(end, sc);
    this.assertMeetingBeforeEventStart(e.start_at, start, end, so, sc);
    const titleTrim = dto.title.trim();
    const titleDup = await this.prisma.event_meetings.findFirst({
      where: { event_id: e.id, title: titleTrim, status: 'scheduled' },
    });
    if (titleDup) {
      throw new ConflictException(
        'Tên buổi họp đã tồn tại trong sự kiện (không trùng nhau)',
      );
    }
    const row = await this.prisma.event_meetings.create({
      data: {
        event_id: e.id,
        title: titleTrim,
        reason: dto.reason?.trim() ? dto.reason.trim() : null,
        status: 'scheduled',
        meeting_type: dto.meetingType,
        start_at: start,
        end_at: end,
        scan_open_at: so,
        scan_close_at: sc,
        actual_end_at: null,
        created_by: u.id,
      },
      include: { users: { select: { email: true, id: true } } },
    });
    return this.serialize(row);
  }

  private async getMeetingInEventOrThrow(eventId: bigint, meetingId: bigint) {
    const m = await this.prisma.event_meetings.findFirst({
      where: { id: meetingId, event_id: eventId },
      include: { users: { select: { email: true, id: true } } },
    });
    if (!m) {
      throw new NotFoundException();
    }
    return m;
  }

  async getOne(
    eventIdParam: string,
    meetingIdParam: string,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanViewEventContent(eventIdParam, u);
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    const m = await this.getMeetingInEventOrThrow(e.id, meetingId);
    return this.serialize(m);
  }

  async update(
    eventIdParam: string,
    meetingIdParam: string,
    dto: UpdateEventMeetingDto,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    const m = await this.getMeetingInEventOrThrow(e.id, meetingId);
    if (m.status === 'cancelled') {
      throw new BadRequestException('Buổi họp đã hủy, không thể sửa');
    }
    const data: Prisma.event_meetingsUpdateInput = {};
    if (dto.title !== undefined) {
      const t = dto.title.trim();
      const dup = await this.prisma.event_meetings.findFirst({
        where: {
          event_id: e.id,
          title: t,
          status: 'scheduled',
          NOT: { id: m.id },
        },
      });
      if (dup) {
        throw new ConflictException(
          'Tên buổi họp đã tồn tại trong sự kiện (không trùng nhau)',
        );
      }
      data.title = t;
    }
    if (dto.reason !== undefined) {
      data.reason = dto.reason?.trim() ? dto.reason.trim() : null;
    }
    if (dto.meetingType !== undefined) {
      data.meeting_type = dto.meetingType;
    }
    if (dto.startAt !== undefined) {
      const newStart = new Date(dto.startAt);
      data.start_at = newStart;
      const w = this.scanWindowFromStart(newStart);
      data.scan_open_at = w.open;
      data.scan_close_at = w.close;
    }
    if (dto.endAt !== undefined) {
      data.end_at = new Date(dto.endAt);
    }
    if (dto.startAt !== undefined || dto.endAt !== undefined) {
      data.actual_end_at = null;
    }
    const start = (data.start_at as Date | undefined) ?? m.start_at;
    const end = (data.end_at as Date | undefined) ?? m.end_at;
    if (end <= start) {
      throw new BadRequestException('end phải sau start');
    }
    let so = (data.scan_open_at as Date | undefined) ?? m.scan_open_at;
    let sc = (data.scan_close_at as Date | undefined) ?? m.scan_close_at;
    if (!so || !sc) {
      const w = this.scanWindowFromStart(start);
      so = w.open;
      sc = w.close;
      data.scan_open_at = w.open;
      data.scan_close_at = w.close;
    }
    this.assertPlannedEndAfterScanWindow(end, sc);
    this.assertMeetingBeforeEventStart(e.start_at, start, end, so, sc);
    const row = await this.prisma.event_meetings.update({
      where: { id: m.id },
      data,
      include: { users: { select: { email: true, id: true } } },
    });
    return this.serialize(row);
  }

  async cancel(
    eventIdParam: string,
    meetingIdParam: string,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    const m = await this.getMeetingInEventOrThrow(e.id, meetingId);
    if (m.status === 'cancelled') {
      throw new BadRequestException('Buổi họp đã được hủy trước đó');
    }
    const now = new Date();
    const row = await this.prisma.event_meetings.update({
      where: { id: m.id },
      data: { status: 'cancelled', cancelled_at: now },
      include: { users: { select: { email: true, id: true } } },
    });
    return this.serialize(row);
  }

  /**
   * Ghi nhận kết thúc sớm (trước mốc dự kiến). Nếu không bấm, kết thúc chính thức = dự kiến (end_at).
   */
  async endEarly(
    eventIdParam: string,
    meetingIdParam: string,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    const m = await this.getMeetingInEventOrThrow(e.id, meetingId);
    if (m.status === 'cancelled') {
      throw new BadRequestException('Buổi họp đã hủy');
    }
    if (m.actual_end_at) {
      throw new BadRequestException('Buổi đã ghi nhận kết thúc sớm');
    }
    const now = new Date();
    if (now.getTime() < m.start_at.getTime()) {
      throw new BadRequestException('Chưa đến thời điểm bắt đầu buổi họp');
    }
    if (now.getTime() >= m.end_at.getTime()) {
      throw new BadRequestException(
        'Không cần thao tác: đã quá hoặc tới mốc dự kiến kết thúc — mặc định theo mốc dự kiện',
      );
    }
    const row = await this.prisma.event_meetings.update({
      where: { id: m.id },
      data: { actual_end_at: now },
      include: { users: { select: { email: true, id: true } } },
    });
    return this.serialize(row);
  }

  async remove(
    eventIdParam: string,
    meetingIdParam: string,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanManageByParam(eventIdParam, u);
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    const m = await this.prisma.event_meetings.findFirst({
      where: { id: meetingId, event_id: e.id },
    });
    if (!m) {
      throw new NotFoundException();
    }
    await this.prisma.event_meetings.delete({ where: { id: meetingId } });
    return { ok: true, id: meetingId.toString() };
  }

  async listAttendance(
    eventIdParam: string,
    meetingIdParam: string,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertCanViewEventContent(eventIdParam, u);
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    await this.getMeetingInEventOrThrow(e.id, meetingId);
    const rows = await this.prisma.meeting_attendances.findMany({
      where: { meeting_id: meetingId },
      include: {
        event_registrations: {
          include: {
            users_event_registrations_user_idTousers: {
              select: { email: true },
            },
          },
        },
        users: {
          select: {
            email: true,
            id: true,
            members: { select: { full_name: true } },
          },
        },
      },
      orderBy: { scanned_at: 'asc' },
    });
    return rows.map((a) => ({
      id: a.id.toString(),
      meetingId: a.meeting_id.toString(),
      registrationId: a.registration_id.toString(),
      userEmail:
        a.event_registrations?.users_event_registrations_user_idTousers?.email,
      scannedBy: a.scanned_by.toString(),
      scannerEmail: a.users?.email,
      scannedAt: a.scanned_at,
      minutesAfterStart: a.minutes_after_start,
      result: a.result,
    }));
  }

  async recordAttendance(
    eventIdParam: string,
    meetingIdParam: string,
    dto: RecordMeetingAttendanceDto,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertEventExistsByParam(eventIdParam);
    if (!(await this.policy.canReviewEventRegistrations(e.id, u))) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo / quản lý sự kiện mới điểm danh',
      );
    }
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    const meeting = await this.getMeetingInEventOrThrow(e.id, meetingId);
    if (meeting.status === 'cancelled') {
      throw new BadRequestException('Buổi họp đã hủy, không điểm danh');
    }
    const regId = toBigId(dto.registrationId, 'registrationId');
    const reg = await this.prisma.event_registrations.findUnique({
      where: { id: regId },
    });
    if (!reg || reg.event_id !== e.id) {
      throw new BadRequestException('Đăng ký không thuộc sự kiện này');
    }
    if (reg.status !== 'approved') {
      throw new BadRequestException('Chỉ điểm danh đăng ký đã duyệt');
    }
    const scannedAt = dto.scannedAt ? new Date(dto.scannedAt) : new Date();
    const { result, minutesAfterStart } = this.computeResult(
      meeting,
      scannedAt,
    );
    try {
      const a = await this.prisma.meeting_attendances.create({
        data: {
          meeting_id: meetingId,
          registration_id: regId,
          scanned_by: u.id,
          scanned_at: scannedAt,
          result,
          minutes_after_start: minutesAfterStart,
        },
      });
      return {
        id: a.id.toString(),
        result: a.result,
        minutesAfterStart: a.minutes_after_start,
        scannedAt: a.scanned_at,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Đã ghi điểm danh cho đăng ký tại buổi này',
        );
      }
      throw err;
    }
  }

  /** Quét cùng mã QR tham dự sự kiện (hash đăng ký) — điểm danh buổi họp. */
  async recordAttendanceByQr(
    eventIdParam: string,
    meetingIdParam: string,
    dto: CheckInByQrDto,
    u: RequestUserPayload,
  ) {
    const e = await this.policy.assertEventExistsByParam(eventIdParam);
    if (!(await this.policy.canReviewEventRegistrations(e.id, u))) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo / quản lý sự kiện mới điểm danh',
      );
    }
    const meetingId = toBigId(meetingIdParam, 'meetingId');
    await this.getMeetingInEventOrThrow(e.id, meetingId);
    const hash = hashQrToken(dto.qrToken.trim());
    const reg = await this.prisma.event_registrations.findFirst({
      where: { event_id: e.id, qr_token_hash: hash },
    });
    if (!reg) {
      throw new NotFoundException('Mã QR không hợp lệ với sự kiện này');
    }
    if (reg.status !== 'approved') {
      throw new BadRequestException(
        'Đăng ký chưa duyệt, không thể điểm danh buổi',
      );
    }
    return this.recordAttendance(
      eventIdParam,
      meetingIdParam,
      {
        registrationId: reg.id.toString(),
        scannedAt: new Date().toISOString(),
      },
      u,
    );
  }
}
