import { IsOptional, IsString } from 'class-validator';

export class CreateParticipationCancellationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
