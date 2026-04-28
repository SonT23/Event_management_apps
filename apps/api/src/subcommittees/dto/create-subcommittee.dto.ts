import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubcommitteeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  /** Không gửi = không giới hạn số người trong tiểu ban */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  maxMembers?: number;
}

export class UpdateSubcommitteeDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  /** Gửi true để bỏ giới hạn (max_members = null). */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  clearMaxMembers?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  maxMembers?: number;
}
