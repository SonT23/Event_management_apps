import { readFileSync } from 'fs';
import { join } from 'path';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    let version: string | undefined;
    try {
      const p = join(__dirname, '..', '..', 'package.json');
      version = JSON.parse(readFileSync(p, 'utf8')).version as string;
    } catch {
      /* dist path khác bản dev — bỏ qua */
    }
    return {
      status: 'ok',
      service: 'media-club-api',
      ...(version ? { version } : {}),
    };
  }

  /** Readiness: kết nối DB; dùng cho probe k8s / load balancer (503 nếu DB không phản hồi). */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok', service: 'media-club-api', database: 'up' as const };
  }
}
