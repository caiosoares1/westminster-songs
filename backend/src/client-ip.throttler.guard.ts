import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate limiting per client IP. Behind a CDN/proxy chain whose length isn't
 * documented (Render), the header that carries the real client IP is
 * configured with CLIENT_IP_HEADER (e.g. cf-connecting-ip); otherwise
 * Express's req.ip (see TRUST_PROXY in main.ts) is used.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: Record<string, unknown>): Promise<string> {
    return Promise.resolve(clientIp(request as unknown as Request));
  }
}

export function clientIp(request: Request): string {
  const headerName = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (headerName) {
    const value = request.headers[headerName];
    const ip = (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();
    if (ip) {
      return ip;
    }
  }
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}
