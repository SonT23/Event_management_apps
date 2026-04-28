import { IsString, Matches } from 'class-validator';

export class AddManagerDto {
  @IsString()
  @Matches(/^\d+$/)
  userId: string;
}
