import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { verifyToken } from '@clerk/backend';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import {
  AuthNotConfiguredError,
  ClerkTokenVerifier,
} from './clerk-token-verifier';

jest.mock('@clerk/backend', () => ({ verifyToken: jest.fn() }));
const mockedVerifyToken = verifyToken as jest.MockedFunction<
  typeof verifyToken
>;

function verifierWith(env: Record<string, string | undefined>) {
  return new ClerkTokenVerifier({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

describe('ClerkTokenVerifier', () => {
  beforeEach(() => mockedVerifyToken.mockReset());

  it('fails closed when no Clerk key is configured', async () => {
    await expect(verifierWith({}).verify('t')).rejects.toBeInstanceOf(
      AuthNotConfiguredError,
    );
    expect(mockedVerifyToken).not.toHaveBeenCalled();
  });

  it("returns the token's subject as the user ID and checks the authorized parties", async () => {
    mockedVerifyToken.mockResolvedValue({ sub: 'user_a' } as Awaited<
      ReturnType<typeof verifyToken>
    >);

    const userId = await verifierWith({
      CLERK_SECRET_KEY: 'sk_test_x',
      CLERK_AUTHORIZED_PARTIES:
        'http://localhost:3001, https://app.example.com',
    }).verify('t');

    expect(userId).toBe('user_a');
    expect(mockedVerifyToken).toHaveBeenCalledWith('t', {
      secretKey: 'sk_test_x',
      jwtKey: undefined,
      authorizedParties: ['http://localhost:3001', 'https://app.example.com'],
    });
  });

  it('rejects a token without a subject', async () => {
    mockedVerifyToken.mockResolvedValue(
      {} as Awaited<ReturnType<typeof verifyToken>>,
    );

    await expect(
      verifierWith({ CLERK_JWT_KEY: 'pem' }).verify('t'),
    ).rejects.toThrow('no subject');
  });
});

describe('ClerkAuthGuard on a public route', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: ClerkTokenVerifier, useValue: { verify: jest.fn() } },
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(() => app.close());

  it('lets the liveness check through without a token', async () => {
    await request(app.getHttpServer()).get('/').expect(200, 'Hello World!');
  });
});
