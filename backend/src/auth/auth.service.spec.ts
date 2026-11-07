import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { hashPassword } from './password';

const jwt = new JwtService({ secret: 'test-secret-test-secret-test-secret' });

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: 'u1',
        name: data.name,
        email: data.email,
        role: data.role,
      })),
    },
  };
}

describe('AuthService', () => {
  const OLD_ENV = process.env.GROUP_INVITE_CODE;
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AuthService;

  beforeEach(() => {
    process.env.GROUP_INVITE_CODE = 'coro-2026';
    prisma = createPrismaMock();
    service = new AuthService(prisma as never, jwt);
  });
  afterAll(() => {
    process.env.GROUP_INVITE_CODE = OLD_ENV;
  });

  const register = (inviteCode = 'coro-2026') =>
    service.register({
      name: 'Caio',
      email: 'caio@example.com',
      password: 'louvor123',
      inviteCode,
    });

  it('rejects a wrong invite code', async () => {
    await expect(register('errado')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects sign-up when no invite code is configured', async () => {
    delete process.env.GROUP_INVITE_CODE;
    await expect(register('')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('makes the first account admin and later ones members', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const first = await register();
    const second = await register();

    expect(first.user.role).toBe('admin');
    expect(second.user.role).toBe('member');
    const payload = await jwt.verifyAsync<{ sub: string }>(first.token);
    expect(payload.sub).toBe('u1');
  });

  it('stores a hash, never the password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(1);
    await register();
    const { data } = prisma.user.create.mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    expect(data.passwordHash).toMatch(/^scrypt\$/);
  });

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u0' });
    await expect(register()).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with the right password only', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Caio',
      email: 'caio@example.com',
      role: 'admin',
      passwordHash: await hashPassword('louvor123'),
    });

    const session = await service.login({
      email: 'caio@example.com',
      password: 'louvor123',
    });
    expect(session.user).toEqual({
      id: 'u1',
      name: 'Caio',
      email: 'caio@example.com',
      role: 'admin',
    });
    await expect(
      service.login({ email: 'caio@example.com', password: 'errada' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('gives the same error for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ninguem@example.com', password: 'x' }),
    ).rejects.toThrow('Invalid email or password');
  });
});
