import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export const USER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;
