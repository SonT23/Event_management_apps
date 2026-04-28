import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, members_membership_status } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { isClubLeadership } from '../auth/utils/has-role';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetMembershipDto } from './dto/set-membership.dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private serializeMember(
    m: Prisma.membersGetPayload<{ include: { departments: true } }>,
  ) {
    return {
      userId: m.user_id.toString(),
      fullName: m.full_name,
      gender: m.gender,
      birthDate: m.birth_date,
      major: m.major,
      primaryDepartmentId: m.primary_department_id?.toString() ?? null,
      primaryDepartment: m.departments
        ? {
            id: m.departments.id,
            code: m.departments.code,
            name: m.departments.name,
          }
        : null,
      positionTitle: m.position_title,
      phone: m.phone,
      membershipStatus: m.membership_status,
      inactiveAt: m.inactive_at,
      inactiveReason: m.inactive_reason,
    };
  }

  async getByUserId(
    id: bigint,
  ): Promise<ReturnType<MembersService['serializeMember']> | null> {
    const m = await this.prisma.members.findUnique({
      where: { user_id: id },
      include: { departments: true },
    });
    if (!m) {
      return null;
    }
    return this.serializeMember(m);
  }

  private buildMemberUpdateData(dto: UpdateProfileDto): Prisma.membersUpdateInput {
    const data: Prisma.membersUpdateInput = {};
    if (dto.fullName !== undefined) {
      data.full_name = dto.fullName;
    }
    if (dto.gender !== undefined) {
      data.gender = dto.gender;
    }
    if (dto.birthDate !== undefined) {
      data.birth_date = new Date(dto.birthDate);
    }
    if (dto.major !== undefined) {
      data.major = dto.major;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }
    if (dto.positionTitle !== undefined) {
      data.position_title = dto.positionTitle;
    }
    if (dto.primaryDepartmentId !== undefined) {
      data.departments = dto.primaryDepartmentId
        ? { connect: { id: dto.primaryDepartmentId } }
        : { disconnect: true };
    }
    return data;
  }

  private async assertDepartmentExists(id: number | null | undefined) {
    if (id == null) {
      return;
    }
    const d = await this.prisma.departments.findUnique({ where: { id } });
    if (!d) {
      throw new BadRequestException('Invalid primaryDepartmentId');
    }
  }

  async updateOwnProfile(current: RequestUserPayload, dto: UpdateProfileDto) {
    await this.assertDepartmentExists(dto.primaryDepartmentId);
    const data = this.buildMemberUpdateData(dto);
    if (Object.keys(data).length === 0) {
      const m = await this.prisma.members.findUniqueOrThrow({
        where: { user_id: current.id },
        include: { departments: true },
      });
      return this.serializeMember(m);
    }
    const m = await this.prisma.members.update({
      where: { user_id: current.id },
      data,
      include: { departments: true },
    });
    return this.serializeMember(m);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private tempPassword() {
    const b = randomBytes(9).toString('base64url');
    return `Tv${b}`;
  }

  async createByStaff(
    current: RequestUserPayload,
    dto: CreateMemberDto,
  ): Promise<{
    member: Awaited<ReturnType<MembersService['getOneForStaff']>>;
    temporaryPassword?: string;
  }> {
    if (!isClubLeadership(current.roleCodes)) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo/điều hành mới tạo hồ sơ hội viên',
      );
    }
    const e = this.normalizeEmail(dto.email);
    const existing = await this.prisma.users.findUnique({ where: { email: e } });
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
      await this.assertDepartmentExists(deptId);
    }
    const plain = dto.password?.trim() ? dto.password : this.tempPassword();
    const wasGenerated = !dto.password?.trim();
    const passHash = await this.auth.hashPassword(plain);
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
      return u;
    });
    const detail = await this.getOneForStaff(user.id.toString(), current);
    return {
      member: detail,
      ...(wasGenerated ? { temporaryPassword: plain } : {}),
    };
  }

  async updateMemberByStaff(
    current: RequestUserPayload,
    targetUserId: string,
    dto: UpdateProfileDto,
  ) {
    if (!isClubLeadership(current.roleCodes)) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo/điều hành mới cập nhật hồ sơ hội viên khác',
      );
    }
    const id = toBigId(targetUserId, 'userId');
    await this.assertDepartmentExists(dto.primaryDepartmentId);
    const m0 = await this.prisma.members.findUnique({ where: { user_id: id } });
    if (!m0) {
      throw new NotFoundException();
    }
    const data = this.buildMemberUpdateData(dto);
    if (Object.keys(data).length === 0) {
      return this.getOneForStaff(targetUserId, current);
    }
    await this.prisma.members.update({
      where: { user_id: id },
      data,
    });
    return this.getOneForStaff(targetUserId, current);
  }

  async listMembers(
    current: RequestUserPayload,
    query: {
      departmentId?: string;
      page: number;
      pageSize: number;
      includeInactive: boolean;
    },
  ) {
    if (!isClubLeadership(current.roleCodes)) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo/điều hành mới xem toàn bộ danh sách thành viên',
      );
    }
    const where: Prisma.membersWhereInput = {};
    if (query.departmentId) {
      where.primary_department_id = Number(query.departmentId);
    }
    if (!query.includeInactive) {
      where.membership_status = members_membership_status.active;
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.members.count({ where }),
      this.prisma.members.findMany({
        where,
        include: {
          departments: true,
          users: { select: { email: true, id: true } },
        },
        orderBy: { full_name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: rows.map((m) => ({
        ...this.serializeMember(m),
        email: m.users?.email,
      })),
    };
  }

  async setMembershipStatus(
    current: RequestUserPayload,
    targetUserId: string,
    dto: SetMembershipDto,
  ) {
    if (!isClubLeadership(current.roleCodes)) {
      throw new ForbiddenException();
    }
    const id = toBigId(targetUserId, 'userId');
    if (id === current.id) {
      throw new BadRequestException(
        'Không tự cập nhật trạng thái hội viên của chính mình qua màn này',
      );
    }
    const m = await this.prisma.members.findUnique({ where: { user_id: id } });
    if (!m) {
      throw new NotFoundException();
    }
    const now = new Date();
    if (dto.status === 'inactive') {
      await this.prisma.$transaction([
        this.prisma.members.update({
          where: { user_id: id },
          data: {
            membership_status: members_membership_status.inactive,
            inactive_at: now,
            inactive_reason: dto.reason ?? null,
            updated_at: new Date(),
          },
        }),
        this.prisma.users.update({
          where: { id },
          data: { is_active: false, updated_at: new Date() },
        }),
        this.prisma.refresh_tokens.deleteMany({ where: { user_id: id } }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.members.update({
          where: { user_id: id },
          data: {
            membership_status: members_membership_status.active,
            inactive_at: null,
            inactive_reason: null,
            updated_at: new Date(),
          },
        }),
        this.prisma.users.update({
          where: { id },
          data: { is_active: true, updated_at: new Date() },
        }),
      ]);
    }
    return this.getOneForStaff(targetUserId, current);
  }

  async hardDeleteUser(current: RequestUserPayload, targetUserId: string) {
    if (!isClubLeadership(current.roleCodes)) {
      throw new ForbiddenException();
    }
    const id = toBigId(targetUserId, 'userId');
    if (id === current.id) {
      throw new BadRequestException('Không thể xoá tài khoản đang dùng');
    }
    const exists = await this.prisma.users.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException();
    }
    await this.prisma.users.delete({ where: { id } });
    return { ok: true, deletedUserId: id.toString() };
  }

  async getOneForStaff(targetUserId: string, current: RequestUserPayload) {
    if (
      !isClubLeadership(current.roleCodes) &&
      toBigId(targetUserId, 'userId') !== current.id
    ) {
      throw new ForbiddenException();
    }
    const m = await this.prisma.members.findUnique({
      where: { user_id: toBigId(targetUserId, 'userId') },
      include: {
        departments: true,
        users: {
          select: {
            email: true,
            id: true,
            last_login_at: true,
            is_active: true,
          },
        },
      },
    });
    if (!m) {
      throw new NotFoundException();
    }
    return {
      ...this.serializeMember(m),
      email: m.users?.email,
      lastLoginAt: m.users?.last_login_at,
      isActive: m.users?.is_active,
    };
  }
}
