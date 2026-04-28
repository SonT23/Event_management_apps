import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isClubLeadership } from '../auth/utils/has-role';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { AddClubRoleDto, PatchClubRoleDto } from './dto/add-club-role.dto';

@Injectable()
export class UserClubRolesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCanViewUser(userId: bigint, u: RequestUserPayload) {
    if (u.id === userId) {
      return;
    }
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
  }

  private serialize(
    r: Prisma.user_club_rolesGetPayload<{
      include: { roles: true; departments: true };
    }>,
  ) {
    return {
      id: r.id.toString(),
      userId: r.user_id.toString(),
      roleId: r.role_id,
      roleCode: r.roles.code,
      roleName: r.roles.name,
      departmentId: r.department_id,
      departmentCode: r.departments?.code ?? null,
      departmentName: r.departments?.name ?? null,
      isPrimary: r.is_primary,
      createdAt: r.created_at,
    };
  }

  private async clearOtherPrimary(
    tx: Prisma.TransactionClient,
    userId: bigint,
    keepId: bigint,
  ) {
    await tx.user_club_roles.updateMany({
      where: { user_id: userId, id: { not: keepId } },
      data: { is_primary: false },
    });
  }

  async listForUser(userIdParam: string, u: RequestUserPayload) {
    const userId = toBigId(userIdParam, 'userId');
    await this.assertCanViewUser(userId, u);
    const rows = await this.prisma.user_club_roles.findMany({
      where: { user_id: userId },
      include: { roles: true, departments: true },
      orderBy: [{ is_primary: 'desc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  async add(userIdParam: string, dto: AddClubRoleDto, u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException(
        'Chỉ lãnh đạo/điều hành mới gán vai trò CLB',
      );
    }
    const userId = toBigId(userIdParam, 'userId');
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user?.is_active) {
      throw new BadRequestException('User không tồn tại hoặc đã ngưng');
    }
    const role = await this.prisma.roles.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new BadRequestException('Vai trò không tồn tại');
    }
    if (dto.departmentId != null) {
      const d = await this.prisma.departments.findUnique({
        where: { id: dto.departmentId },
      });
      if (!d) {
        throw new BadRequestException('Ban không tồn tại');
      }
    }
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user_club_roles.create({
          data: {
            user_id: userId,
            role_id: dto.roleId,
            department_id: dto.departmentId ?? null,
            is_primary: dto.isPrimary ?? false,
          },
          include: { roles: true, departments: true },
        });
        if (dto.isPrimary) {
          await this.clearOtherPrimary(tx, userId, created.id);
        }
        return created;
      });
      return this.serialize(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Vai trò + ban này đã gán cho thành viên');
      }
      throw err;
    }
  }

  async remove(assignmentIdParam: string, u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
    const id = toBigId(assignmentIdParam, 'assignmentId');
    const row = await this.prisma.user_club_roles.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException();
    }
    await this.prisma.user_club_roles.delete({ where: { id } });
    return { ok: true, id: id.toString() };
  }

  async patch(
    assignmentIdParam: string,
    dto: PatchClubRoleDto,
    u: RequestUserPayload,
  ) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
    const id = toBigId(assignmentIdParam, 'assignmentId');
    const row = await this.prisma.user_club_roles.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException();
    }
    if (dto.isPrimary !== true) {
      throw new BadRequestException('Hiện chỉ hỗ trợ đặt isPrimary: true');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.clearOtherPrimary(tx, row.user_id, id);
      return tx.user_club_roles.update({
        where: { id },
        data: { is_primary: true },
        include: { roles: true, departments: true },
      });
    });
    return this.serialize(updated);
  }
}
