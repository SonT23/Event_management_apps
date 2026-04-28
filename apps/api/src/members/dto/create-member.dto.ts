import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) {
      return undefined;
    }
    const t = String(value).trim();
    return t === '' ? undefined : t;
  })
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MinLength(8, { message: 'password min 8 characters' })
  /** Bỏ trống: hệ thống tạo mật khẩu tạm (trả về một lần trong phản hồi) */
  password?: string;

  @IsIn(['male', 'female', 'other', 'unspecified'])
  @IsOptional()
  gender?: 'male' | 'female' | 'other' | 'unspecified';

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  major?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  primaryDepartmentId?: number;
}
