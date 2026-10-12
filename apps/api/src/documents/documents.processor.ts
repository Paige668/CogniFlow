import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmbeddingService, isPermanentEmbeddingError } from '../embedding.service';

export interface ProcessDocumentJob {
    documentId: string;
}

@Processor('documents')
export class DocumentsProcessor extends WorkerHost {
    private readonly logger = new Logger(DocumentsProcessor.name);

    constructor(
        private prisma: PrismaService,
        private embeddings: EmbeddingService,
    ) {
        super();
    }

    async process(job: Job<ProcessDocumentJob>): Promise<void> {
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);

        switch (job.name) {
            case 'process-document':
                return this.handleProcessDocument(job);
            default:
                throw new UnrecoverableError(`Unknown job name: ${job.name}`);
        }
    }

    private async handleProcessDocument(job: Job<ProcessDocumentJob>) {
        const { documentId } = job.data;

        // Load the content here instead of carrying it in the job, so every retry
        // embeds what is actually stored.
        const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) {
            this.logger.warn(`Document ${documentId} was deleted before it was processed`);
            return;
        }

        let embedding: number[];
        try {
            // No SDK-level retries here: the queue retries the whole job (see DocumentsQueueModule).
            embedding = await this.embeddings.embed(doc.content, { maxRetries: 0 });
        } catch (error) {
            throw await this.recordEmbeddingFailure(job, error);
        }

        const vectorString = `[${embedding.join(',')}]`;
        await this.prisma.$executeRaw`
            UPDATE documents
            SET embedding = ${vectorString}::vector, status = 'READY', error = NULL, "updatedAt" = NOW()
            WHERE id = ${documentId}
        `;

        this.logger.log(`Document ${documentId} embedded and searchable`);
    }

    /**
     * Marks the document FAILED once no retry is left, and returns the error to throw so
     * BullMQ skips the remaining attempts for failures that retrying cannot fix.
     */
    private async recordEmbeddingFailure(job: Job<ProcessDocumentJob>, error: unknown): Promise<Error> {
        const { documentId } = job.data;
        const message = error instanceof Error ? error.message : String(error);
        const permanent = isPermanentEmbeddingError(error);
        // Same rule BullMQ applies after we throw, so the status we record matches what the queue does next.
        const attempts = job.opts.attempts ?? 1;
        const willRetry = !permanent && job.attemptsMade + 1 < attempts;

        this.logger.warn(
            `Embedding failed for document ${documentId} (attempt ${job.attemptsMade + 1}/${attempts}, ` +
                `${willRetry ? 'will retry' : 'giving up'}): ${message}`,
        );

        if (!willRetry) {
            // updateMany: the document may have been deleted meanwhile, which is not an error.
            await this.prisma.document.updateMany({
                where: { id: documentId },
                data: { status: 'FAILED', error: message },
            });
        }

        if (permanent) return new UnrecoverableError(message);
        return error instanceof Error ? error : new Error(message);
    }
}
