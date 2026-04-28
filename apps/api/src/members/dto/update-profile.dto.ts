import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  /** MSSV — gửi "" hoặc null để xóa */
  studentId?: string | null;

  @IsIn(['male', 'female', 'other', 'unspecified'])
  @IsOptional()
  gender?: 'male' | 'female' | 'other' | 'unspecified';

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(180)
  major?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  primaryDepartmentId?: number | null;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  positionTitle?: string;
}
