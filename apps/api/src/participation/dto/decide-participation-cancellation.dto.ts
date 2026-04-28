import { IsIn } from 'class-validator';

export class DecideParticipationCancellationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
