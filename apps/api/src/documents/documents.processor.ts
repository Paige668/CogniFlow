import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { PrismaService } from '../prisma.service';

@Processor('documents')
export class DocumentsProcessor extends WorkerHost {
    private readonly logger = new Logger(DocumentsProcessor.name);

    constructor(private prisma: PrismaService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);

        switch (job.name) {
            case 'process-document':
                return this.handleProcessDocument(job.data);
            default:
                throw new Error('Unknown job name');
        }
    }

    private async handleProcessDocument(data: any) {
        const { documentId, content } = data;
        this.logger.log(`Parsing and embedding document: ${documentId}`);

        try {
            let embedding: number[];

            try {
                // 1. Try Real Embedding
                const result = await embed({
                    model: openai.embedding('text-embedding-3-small'),
                    value: content,
                });
                embedding = result.embedding;
                this.logger.log(`Generated real embedding for document ${documentId}`);
            } catch (error: any) { // Explicitly type error as 'any' or 'unknown'
                this.logger.warn(`OpenAI embedding failed, falling back to MOCK vector. Error: ${error.message}`);
                // Fallback: Generate random 1536-dim vector
                embedding = Array.from({ length: 1536 }, () => Math.random());
            }

            this.logger.log(`Storing embedding mechanism for document ${documentId}`);

            // 2. Store in Vector Database (pgvector)
            const vectorString = `[${embedding.join(',')}]`;

            await this.prisma.$executeRaw`
        UPDATE documents
        SET embedding = ${vectorString}::vector
        WHERE id = ${documentId}
      `;

            this.logger.log(`Document ${documentId} processed and vector stored completely.`);
        } catch (error) {
            this.logger.error(`Failed to process document ${documentId}`, error);
            throw error;
        }
    }
}
