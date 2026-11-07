import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  USER_PUBLIC_FIELDS,
  type AuthUser,
  type JwtPayload,
} from './auth.types';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { hashPassword, safeEqual, verifyPassword } from './password';

// Hash checked when the email doesn't exist, so a wrong email takes as long
// as a wrong password (doesn't reveal who has an account).
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  Buffer.alloc(64).toString('base64');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const inviteCode = process.env.GROUP_INVITE_CODE;
    if (!inviteCode || !safeEqual(dto.inviteCode.trim(), inviteCode)) {
      throw new ForbiddenException('Invalid invite code');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    // The first account becomes the group admin.
    const isFirst = (await this.prisma.user.count()) === 0;
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email,
        passwordHash,
        role: isFirst ? 'admin' : 'member',
      },
      select: USER_PUBLIC_FIELDS,
    });

    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.session({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }

  private async session(user: AuthUser) {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return { token: await this.jwt.signAsync(payload), user };
  }
}
