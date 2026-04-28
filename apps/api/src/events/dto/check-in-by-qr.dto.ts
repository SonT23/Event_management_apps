import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CheckInByQrDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  qrToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
