import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsProcessor } from './documents.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'documents',
      // The queue owns retries for background jobs: 3 tries, 5s then 10s apart.
      // DocumentsProcessor fails fast on errors that retrying cannot fix.
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  providers: [DocumentsProcessor],
  exports: [BullModule],
})
export class DocumentsQueueModule {}
