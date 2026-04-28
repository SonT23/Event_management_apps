import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AddSubcommitteeMemberDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  userId!: string;
}
