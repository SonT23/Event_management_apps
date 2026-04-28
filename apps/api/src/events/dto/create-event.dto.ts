import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  @IsOptional()
  expectedEndAt?: string;

  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  defaultCancelMinutes?: number;

  /** userId (chuỗi số) — quản lý sự kiện, chọn từ danh sách hội viên */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  managerUserIds?: string[];
}
