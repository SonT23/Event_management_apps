import { BadRequestException } from '@nestjs/common';

export function toBigId(id: string, field = 'id'): bigint {
  if (!/^\d+$/.test(id)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return BigInt(id);
}
