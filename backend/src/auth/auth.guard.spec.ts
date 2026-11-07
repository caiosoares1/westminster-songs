import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { ADMIN_ONLY_KEY, IS_PUBLIC_KEY } from './decorators';

const jwt = new JwtService({ secret: 'test-secret-test-secret-test-secret' });

function context(
  authorization: string | undefined,
  metadata: Record<string, boolean>,
) {
  const request: Record<string, unknown> = { headers: { authorization } };
  const handler = () => undefined;
  Reflect.defineMetadata(IS_PUBLIC_KEY, metadata.public, handler);
  Reflect.defineMetadata(ADMIN_ONLY_KEY, metadata.admin, handler);
  const ctx = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('AuthGuard', () => {
  const findUnique = jest.fn();
  const guard = new AuthGuard(new Reflector(), jwt, {
    user: { findUnique },
  } as never);

  beforeEach(() => findUnique.mockReset());

  it('lets public routes through without a token', async () => {
    await expect(
      guard.canActivate(context(undefined, { public: true }).ctx),
    ).resolves.toBe(true);
  });

  it('rejects missing, malformed and forged tokens', async () => {
    const forged = await new JwtService({
      secret: 'another-secret-another-secret-12345',
    }).signAsync({ sub: 'u1', role: 'admin' });
    for (const header of [
      undefined,
      'Token abc',
      'Bearer xyz',
      `Bearer ${forged}`,
    ]) {
      await expect(
        guard.canActivate(context(header, {}).ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('rejects tokens of deleted users', async () => {
    const token = await jwt.signAsync({ sub: 'gone', role: 'member' });
    findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(context(`Bearer ${token}`, {}).ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the current user and enforces admin-only routes', async () => {
    // The role in the token is ignored: it is read from the database.
    const token = await jwt.signAsync({ sub: 'u2', role: 'admin' });
    findUnique.mockResolvedValue({ id: 'u2', role: 'member' });

    const { ctx, request } = context(`Bearer ${token}`, {});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u2', role: 'member' });

    await expect(
      guard.canActivate(context(`Bearer ${token}`, { admin: true }).ctx),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
