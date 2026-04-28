import { IsIn } from 'class-validator';

export class DecideAbsenceRequestDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
