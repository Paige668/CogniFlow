import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentsQueueModule } from './documents-queue.module';
import { AgentService } from './agent.service';

@Module({
  imports: [DocumentsQueueModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, AgentService],
  exports: [AgentService],
})
export class DocumentsModule { }
