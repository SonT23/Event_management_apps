import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAbsenceRequestDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
