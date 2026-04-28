import { createHash } from 'crypto';

export function hashQrToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
