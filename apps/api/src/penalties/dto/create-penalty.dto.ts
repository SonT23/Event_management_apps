import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePenaltyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  userId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  eventId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  meetingId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  ruleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  points?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
