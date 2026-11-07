import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route reachable without logging in. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ADMIN_ONLY_KEY = 'adminOnly';
/** Route restricted to group admins (e.g. deleting). */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
