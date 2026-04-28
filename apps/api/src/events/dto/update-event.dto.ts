import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  expectedEndAt?: string;

  @IsIn(['draft', 'published', 'ongoing', 'ended', 'cancelled'])
  @IsOptional()
  status?: 'draft' | 'published' | 'ongoing' | 'ended' | 'cancelled';

  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  defaultCancelMinutes?: number;
}
