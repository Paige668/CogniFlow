import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest } from './current-user-id.decorator';
import {
  AuthNotConfiguredError,
  ClerkTokenVerifier,
} from './clerk-token-verifier';

/**
 * Registered globally (APP_GUARD in AppModule), so a new route is protected unless it is
 * marked @Public(). Reads `Authorization: Bearer <Clerk session token>`.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: ClerkTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Sign in to use CogniFlow.');
    }

    try {
      req.userId = await this.verifier.verify(token);
      return true;
    } catch (error) {
      if (error instanceof AuthNotConfiguredError) {
        // A server problem, not the caller's: say so, and keep the details in the log.
        this.logger.error(error.message);
        throw new InternalServerErrorException(
          'Sign-in is not set up on the server.',
        );
      }
      // Expired, wrongly signed or issued for another site: the reason stays in the log.
      this.logger.warn(
        `Rejected session token: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException(
        'Your session is invalid or has expired. Please sign in again.',
      );
    }
  }
}
