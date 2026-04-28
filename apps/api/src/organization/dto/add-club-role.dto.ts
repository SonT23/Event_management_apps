import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class AddClubRoleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class PatchClubRoleDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
