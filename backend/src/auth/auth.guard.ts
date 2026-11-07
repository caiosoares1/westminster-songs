import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  USER_PUBLIC_FIELDS,
  type AuthUser,
  type JwtPayload,
} from './auth.types';
import { ADMIN_ONLY_KEY, IS_PUBLIC_KEY } from './decorators';

export type AuthenticatedRequest = Request & { user: AuthUser };

/**
 * Global guard: every route needs a valid token unless marked @Public().
 * The user is reloaded from the database, so a removed member or a role
 * change takes effect immediately, not when the token expires.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: USER_PUBLIC_FIELDS,
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    request.user = user;

    if (
      this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, targets) &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException('Only group admins can do this');
    }

    return true;
  }
}
