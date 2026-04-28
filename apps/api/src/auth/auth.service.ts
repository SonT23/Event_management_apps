import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, members } from '@prisma/client';
import { randomBytes, createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserNotificationsService } from '../notifications/user-notifications.service';
import { BCRYPT_ROUNDS } from './auth.constants';
import { RequestUserPayload } from './types/request-user-payload';
import { RegisterDto } from './dto/register.dto';
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import type { Request, Response } from 'express';
import { AUTH_REFRESH_COOKIE, AUTH_ACCESS_COOKIE } from './auth.constants';

const userWithRoles = {
  members: true,
  user_club_roles: { include: { roles: true, departments: true } },
} as const;

type UserWithAuth = Prisma.usersGetPayload<{ include: typeof userWithRoles }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hashRefresh(raw: string) {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  toRequestPayload(user: UserWithAuth): RequestUserPayload {
    return {
      id: user.id,
      email: user.email,
      is_active: user.is_active,
      members: user.members,
      user_club_roles: user.user_club_roles,
      roleCodes: user.user_club_roles
        .filter((r) => r.roles)
        .map((r) => r.roles!.code),
    };
  }

  toUserResponse(u: RequestUserPayload) {
    return {
      id: u.id.toString(),
      email: u.email,
      member: u.members ? this.toMemberResponse(u.members) : null,
      clubRoles: u.user_club_roles
        .filter((row) => row.roles)
        .map((row) => ({
          roleCode: row.roles!.code,
          roleName: row.roles!.name,
          departmentId:
            row.department_id != null ? row.department_id.toString() : null,
          departmentCode: row.departments?.code ?? null,
          departmentName: row.departments?.name ?? null,
          isPrimary: row.is_primary,
        })),
    };
  }

  /** Dùng cho /auth/me, login, register: kèm thông báo chưa đọc. */
  async toUserResponseWithNotifications(u: RequestUserPayload) {
    const base = this.toUserResponse(u);
    const unreadNotifications = await this.userNotifications.listUnread(u.id);
    return { ...base, unreadNotifications };
  }

  toMemberResponse(m: members) {
    return {
      userId: m.user_id.toString(),
      fullName: m.full_name,
      gender: m.gender,
      birthDate: m.birth_date,
      major: m.major,
      primaryDepartmentId: m.primary_department_id?.toString() ?? null,
      positionTitle: m.position_title,
      phone: m.phone,
      membershipStatus: m.membership_status,
      inactiveAt: m.inactive_at,
      inactiveReason: m.inactive_reason,
    };
  }

  async hashPassword(plain: string) {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  /**
   * Đăng nhập: so khớp mật khẩu với cột `password_hash` (bcrypt).
   */
  async validateUserByCredentials(
    email: string,
    plainPassword: string,
  ): Promise<RequestUserPayload> {
    const e = this.normalizeEmail(email);
    const user = await this.prisma.users.findUnique({
      where: { email: e },
      include: userWithRoles,
    });
    if (!user?.is_active) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.password_hash?.length) {
      throw new UnauthorizedException('Invalid email or password');
    }
    let match = false;
    try {
      match = await bcrypt.compare(plainPassword, user.password_hash);
    } catch {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!match) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.members?.membership_status === 'inactive') {
      throw new UnauthorizedException('Tài khoản hội viên đã ngưng hoạt động');
    }
    return this.toRequestPayload(user);
  }

  async findUserByIdForAuth(id: bigint): Promise<RequestUserPayload | null> {
    const user = await this.prisma.users.findUnique({
      where: { id },
      include: userWithRoles,
    });
    if (!user || !user.is_active) {
      return null;
    }
    if (user.members?.membership_status === 'inactive') {
      return null;
    }
    return this.toRequestPayload(user);
  }

  private signAccess(u: RequestUserPayload) {
    return this.jwt.sign({ sub: u.id.toString(), email: u.email });
  }

  private async createRefresh(
    u: RequestUserPayload,
    meta: { userAgent: string; ip: string; familyId?: string | null },
  ) {
    const days =
      parseInt(this.config.get<string>('REFRESH_DAYS') ?? '7', 10) || 7;
    const raw = randomBytes(48).toString('hex');
    const familyId = meta.familyId ?? randomUUID();
    const expires = new Date(Date.now() + days * 864e5);
    const row = await this.prisma.refresh_tokens.create({
      data: {
        user_id: u.id,
        token_hash: this.hashRefresh(raw),
        family_id: familyId,
        expires_at: expires,
        user_agent: (meta.userAgent || 'unknown').slice(0, 500),
        ip: (meta.ip || '0.0.0.0').slice(0, 45),
      },
    });
    return { raw, row };
  }

  private async updateLastLogin(id: bigint) {
    await this.prisma.users.update({
      where: { id },
      data: { last_login_at: new Date() },
    });
  }

  /**
   * Cấp cặp access (JWT) + refresh (lưu hash SHA-256 trong DB), xoay chuyển an toàn.
   */
  async issueTokenPair(
    u: RequestUserPayload,
    res: Response,
    meta: { userAgent: string; ip: string; rotateFromHash?: string },
  ) {
    await this.updateLastLogin(u.id);
    const access = this.signAccess(u);
    let family: string | null = null;
    if (meta.rotateFromHash) {
      const old = await this.prisma.refresh_tokens.findFirst({
        where: {
          token_hash: meta.rotateFromHash,
          revoked_at: null,
        },
      });
      if (!old) {
        throw new UnauthorizedException('Invalid refresh');
      }
      if (old.expires_at < new Date()) {
        throw new UnauthorizedException('Refresh expired');
      }
      if (old.user_id !== u.id) {
        throw new UnauthorizedException();
      }
      family = old.family_id;
    }
    const { raw, row: newRow } = await this.createRefresh(u, {
      userAgent: meta.userAgent,
      ip: meta.ip,
      familyId: family,
    });
    if (meta.rotateFromHash) {
      await this.prisma.refresh_tokens.updateMany({
        where: { token_hash: meta.rotateFromHash, revoked_at: null },
        data: { revoked_at: new Date(), replaced_by_id: newRow.id },
      });
    }
    setAuthCookies(res, this.config, access, raw);
    return {
      accessToken: access,
      refreshToken: raw,
      tokenType: 'Bearer' as const,
    };
  }

  /**
   * Đổi mật khẩu: hủy mọi refresh, xoá cookie.
   */
  async changePassword(
    u: RequestUserPayload,
    currentPassword: string,
    newPassword: string,
    res: Response,
  ) {
    const full = await this.prisma.users.findUniqueOrThrow({
      where: { id: u.id },
    });
    const ok = await bcrypt.compare(currentPassword, full.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Current password is wrong');
    }
    const newHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id: u.id },
        data: { password_hash: newHash, updated_at: new Date() },
      }),
      this.prisma.refresh_tokens.deleteMany({ where: { user_id: u.id } }),
    ]);
    clearAuthCookies(res, this.config);
    return { ok: true, message: 'Sign in again with new password' };
  }

  /**
   * Đăng ký công khai: tạo user + members + role MEMBER.
   */
  async register(
    dto: RegisterDto,
    res: Response,
    client: { userAgent: string; ip: string },
  ): Promise<{
    user: ReturnType<AuthService['toUserResponse']>;
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
  }> {
    const e = this.normalizeEmail(dto.email);
    const existing = await this.prisma.users.findUnique({
      where: { email: e },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const memberRole = await this.prisma.roles.findFirst({
      where: { code: 'MEMBER' },
    });
    if (!memberRole) {
      throw new BadRequestException('MEMBER role not configured in DB');
    }
    const deptId = dto.primaryDepartmentId;
    if (deptId != null) {
      const d = await this.prisma.departments.findUnique({
        where: { id: deptId },
      });
      if (!d) {
        throw new BadRequestException('Invalid primaryDepartmentId');
      }
    }
    const passHash = await this.hashPassword(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: {
          email: e,
          password_hash: passHash,
        },
      });
      await tx.members.create({
        data: {
          user_id: u.id,
          full_name: dto.fullName,
          gender: dto.gender ?? 'unspecified',
          birth_date: dto.birthDate ? new Date(dto.birthDate) : null,
          major: dto.major ?? null,
          phone: dto.phone ?? null,
          primary_department_id: deptId ?? null,
          position_title: 'Thành viên',
        },
      });
      await tx.user_club_roles.create({
        data: {
          user_id: u.id,
          role_id: memberRole.id,
          department_id: deptId ?? null,
          is_primary: true,
        },
      });
      return tx.users.findUniqueOrThrow({
        where: { id: u.id },
        include: userWithRoles,
      });
    });
    const payload = this.toRequestPayload(user);
    const out = await this.issueTokenPair(payload, res, client);
    return { ...out, user: await this.toUserResponseWithNotifications(payload) };
  }

  static clientMeta(req: Request) {
    const ua = (req.headers['user-agent'] as string) ?? 'unknown';
    const xf = req.headers['x-forwarded-for'] as string | undefined;
    const ip =
      (xf && xf.split(',')[0].trim()) ||
      (req as Request & { ip?: string }).ip ||
      req.socket?.remoteAddress ||
      '0.0.0.0';
    return { userAgent: ua, ip: String(ip) };
  }

  getRefreshFromRequest(req: Request) {
    const name =
      this.config.get<string>('AUTH_REFRESH_COOKIE') ?? AUTH_REFRESH_COOKIE;
    const c = (req as Request & { cookies?: Record<string, string> }).cookies;
    if (c?.[name]) {
      return c[name] as string;
    }
    const body = req.body as { refreshToken?: string } | undefined;
    if (body?.refreshToken) {
      return String(body.refreshToken);
    }
    return null;
  }

  getAccessFromRequest(req: Request) {
    const name =
      this.config.get<string>('AUTH_ACCESS_COOKIE') ?? AUTH_ACCESS_COOKIE;
    const c = (req as Request & { cookies?: Record<string, string> }).cookies;
    return c?.[name] ?? null;
  }

  async refreshTokens(req: Request, res: Response) {
    const raw = this.getRefreshFromRequest(req);
    if (!raw) {
      throw new UnauthorizedException('No refresh token');
    }
    const h = this.hashRefresh(raw);
    const row = await this.prisma.refresh_tokens.findFirst({
      where: { token_hash: h, revoked_at: null },
    });
    if (!row || row.expires_at < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh');
    }
    const u = await this.findUserByIdForAuth(row.user_id);
    if (!u) {
      throw new UnauthorizedException();
    }
    const m = AuthService.clientMeta(req);
    return this.issueTokenPair(u, res, {
      userAgent: m.userAgent,
      ip: m.ip,
      rotateFromHash: h,
    });
  }

  async logout(req: Request, res: Response) {
    const raw = this.getRefreshFromRequest(req);
    if (raw) {
      const h = this.hashRefresh(raw);
      await this.prisma.refresh_tokens.updateMany({
        where: { token_hash: h },
        data: { revoked_at: new Date() },
      });
    }
    clearAuthCookies(res, this.config);
    return { ok: true };
  }
}
