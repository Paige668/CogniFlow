import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';

/** Thrown when the API has no Clerk key, so no token can be checked at all. */
export class AuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Clerk is not configured: set CLERK_SECRET_KEY (or CLERK_JWT_KEY) for the API.',
    );
    this.name = 'AuthNotConfiguredError';
  }
}

/**
 * Checks a Clerk session token and returns the Clerk user ID it was issued for.
 * Kept in its own provider so tests can replace it without real Clerk keys.
 */
@Injectable()
export class ClerkTokenVerifier {
  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<string> {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    // With the PEM public key the check runs without a network call to Clerk.
    const jwtKey = this.config.get<string>('CLERK_JWT_KEY');
    if (!secretKey && !jwtKey) throw new AuthNotConfiguredError();

    // The `azp` claim names the site the token was issued to. Listing the web app's origin
    // stops a token that some other site obtained for the same Clerk app from being accepted.
    const authorizedParties = this.config
      .get<string>('CLERK_AUTHORIZED_PARTIES')
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const payload = await verifyToken(token, {
      secretKey,
      jwtKey,
      ...(authorizedParties?.length && { authorizedParties }),
    });

    if (!payload.sub) throw new Error('Session token has no subject');
    return payload.sub;
  }
}
