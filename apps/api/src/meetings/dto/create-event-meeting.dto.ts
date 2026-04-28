import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const MEETING_TYPES = ['pre_event', 'in_event'] as const;

export class CreateEventMeetingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** Lý do / mục đích buổi họp */
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  reason?: string;

  @IsIn(MEETING_TYPES)
  meetingType!: (typeof MEETING_TYPES)[number];

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}

export class UpdateEventMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  reason?: string;

  @IsOptional()
  @IsIn(MEETING_TYPES)
  meetingType?: (typeof MEETING_TYPES)[number];

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}
