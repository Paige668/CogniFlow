import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { EmbeddingService } from './embedding.service';
import { DocumentsModule } from './documents/documents.module';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { LoggingInterceptor } from './logging.interceptor';
import { ClerkTokenVerifier } from './auth/clerk-token-verifier';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DocumentsModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
  ],
  controllers: [AppController, MetricsController, FeatureFlagsController],
  providers: [
    AppService,
    PrismaService,
    EmbeddingService,
    MetricsService,
    FeatureFlagsService,
    ClerkTokenVerifier,
    // Every route needs a signed-in user unless it is marked @Public().
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [
    PrismaService,
    EmbeddingService,
    MetricsService,
    FeatureFlagsService,
  ],
})
export class AppModule {}
