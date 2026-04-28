import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class RecordMeetingAttendanceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  registrationId!: string;

  @IsOptional()
  @IsDateString()
  scannedAt?: string;
}
