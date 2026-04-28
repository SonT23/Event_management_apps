import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'password min 8 characters' })
  password: string;

  @IsString()
  @MinLength(1)
  fullName: string;

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
  /** Ban chính (mã từ bảng departments) — cần khi gán role MEMBER */
  primaryDepartmentId?: number;
}
