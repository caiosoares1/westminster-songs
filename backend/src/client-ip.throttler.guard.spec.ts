import type { Request } from 'express';
import { clientIp } from './client-ip.throttler.guard';

const request = (headers: Record<string, string>, ip = '10.0.0.1') =>
  ({ headers, ip }) as unknown as Request;

describe('clientIp', () => {
  const OLD = process.env.CLIENT_IP_HEADER;
  afterEach(() => {
    process.env.CLIENT_IP_HEADER = OLD;
  });

  it('uses the configured header when present', () => {
    process.env.CLIENT_IP_HEADER = 'CF-Connecting-IP';
    expect(clientIp(request({ 'cf-connecting-ip': '203.0.113.7' }))).toBe(
      '203.0.113.7',
    );
  });

  it('falls back to req.ip when the header is missing or not configured', () => {
    process.env.CLIENT_IP_HEADER = 'cf-connecting-ip';
    expect(clientIp(request({}))).toBe('10.0.0.1');
    delete process.env.CLIENT_IP_HEADER;
    expect(clientIp(request({ 'cf-connecting-ip': '203.0.113.7' }))).toBe(
      '10.0.0.1',
    );
  });
});
