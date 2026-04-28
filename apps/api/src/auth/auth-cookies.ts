import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from './auth.constants';

type CookieOptions = {
  accessMaxAgeSec: number;
  refreshMaxAgeSec: number;
  secure: boolean;
};

function parseDurationToSec(v: string, fallback: number): number {
  const m = /^(\d+)([smhd])$/i.exec(v?.trim() ?? '');
  if (!m) return fallback;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === 's') return n;
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  if (u === 'd') return n * 86400;
  return fallback;
}

export function getCookieConfig(config: ConfigService): CookieOptions {
  const accessStr =
    config.get<string>('JWT_ACCESS_EXPIRES') ??
    config.get<string>('JWT_EXPIRES_IN') ??
    '15m';
  const accessMaxAgeSec = parseDurationToSec(accessStr, 900);
  const refreshDays =
    parseInt(config.get<string>('REFRESH_DAYS') ?? '7', 10) || 7;
  return {
    accessMaxAgeSec,
    refreshMaxAgeSec: refreshDays * 86400,
    secure: config.get<string>('COOKIE_SECURE') === 'true',
  };
}

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
): void {
  const names = {
    access: config.get<string>('AUTH_ACCESS_COOKIE') ?? AUTH_ACCESS_COOKIE,
    refresh: config.get<string>('AUTH_REFRESH_COOKIE') ?? AUTH_REFRESH_COOKIE,
  };
  const opt = getCookieConfig(config);
  res.cookie(names.access, accessToken, {
    httpOnly: true,
    secure: opt.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: opt.accessMaxAgeSec * 1000,
  });
  res.cookie(names.refresh, refreshToken, {
    httpOnly: true,
    secure: opt.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: opt.refreshMaxAgeSec * 1000,
  });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const names = {
    access: config.get<string>('AUTH_ACCESS_COOKIE') ?? AUTH_ACCESS_COOKIE,
    refresh: config.get<string>('AUTH_REFRESH_COOKIE') ?? AUTH_REFRESH_COOKIE,
  };
  const secure = config.get<string>('COOKIE_SECURE') === 'true';
  for (const name of [names.access, names.refresh]) {
    res.clearCookie(name, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'lax',
    });
  }
}
