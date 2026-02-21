import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsProcessor } from './documents.processor';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'documents',
        }),
    ],
    providers: [DocumentsProcessor],
    exports: [BullModule],
})
export class DocumentsQueueModule { }
