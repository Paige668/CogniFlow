import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/** A request after ClerkAuthGuard has checked its session token. */
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * The Clerk user ID of the signed-in caller, set by ClerkAuthGuard.
 * Throws instead of returning undefined, so a route that was marked public by mistake
 * cannot run its queries without an owner.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.userId) throw new UnauthorizedException('Sign in first.');
    return req.userId;
  },
);
