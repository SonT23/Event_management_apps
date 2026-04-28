import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateWarningDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  toUserId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  body?: string;
}
