import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const MEMBERSHIP_STATUS_VALUES = ['active', 'inactive'] as const;
export type MembershipStatusDto = (typeof MEMBERSHIP_STATUS_VALUES)[number];

export class SetMembershipDto {
  @IsEnum(MEMBERSHIP_STATUS_VALUES, {
    message: 'status must be active or inactive',
  })
  status!: MembershipStatusDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
