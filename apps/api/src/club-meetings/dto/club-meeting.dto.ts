import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const KINDS = [
  'quarterly',
  'year_end',
  'board',
  'general',
  'other',
  'emergency',
] as const;

const SCOPES = [
  'all_members',
  'club_leadership',
  'dept_heads_only',
  'selected_members',
] as const;

export class CreateClubMeetingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  detail?: string;

  @IsIn(KINDS)
  kind!: (typeof KINDS)[number];

  @IsIn(SCOPES)
  mandatoryScope!: (typeof SCOPES)[number];

  /** Bắt buộc khi mandatoryScope = selected_members: danh sách user id được mời */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  invitedUserIds?: string[];

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}

export class RequestClubMeetingAbsenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  reason!: string;
}

export class DecideClubMeetingAbsenceDto {
  @IsIn(['approved', 'rejected'] as const)
  status!: 'approved' | 'rejected';
}
