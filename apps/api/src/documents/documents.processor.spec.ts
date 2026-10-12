import { Test } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import { APICallError, LoadAPIKeyError } from 'ai';
import { DocumentsProcessor, ProcessDocumentJob } from './documents.processor';
import { PrismaService } from '../prisma.service';
import { EmbeddingService } from '../embedding.service';

// A job as BullMQ hands it to the worker: `attemptsMade` counts the attempts that already failed.
function makeJob(attemptsMade: number, attempts = 3) {
  return {
    id: 'job-1',
    name: 'process-document',
    data: { documentId: 'doc-1' },
    attemptsMade,
    opts: { attempts },
  } as unknown as Job<ProcessDocumentJob>;
}

function apiError(statusCode: number, message: string, isRetryable: boolean, data?: unknown) {
  return new APICallError({
    message,
    url: 'https://api.openai.com/v1/embeddings',
    requestBodyValues: {},
    statusCode,
    isRetryable,
    data,
  });
}

// Shape of the error OpenAI returned on 2026-09-29 for an account without credits.
const outOfCredits = () =>
  apiError(429, 'You have no credits remaining.', true, {
    error: { type: 'insufficient_quota', code: 'credit_balance_exhausted' },
  });

describe('DocumentsProcessor', () => {
  let processor: DocumentsProcessor;
  let prisma: {
    document: { findUnique: jest.Mock; updateMany: jest.Mock };
    $executeRaw: jest.Mock;
  };
  let embeddings: { embed: jest.Mock };

  beforeEach(async () => {
    prisma = {
      document: {
        findUnique: jest.fn().mockResolvedValue({ id: 'doc-1', content: 'hello world' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    embeddings = { embed: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: EmbeddingService, useValue: embeddings },
      ],
    }).compile();
    processor = moduleRef.get(DocumentsProcessor);
  });

  it('embeds the stored content without SDK retries and marks the document READY', async () => {
    embeddings.embed.mockResolvedValue([0.6, 0.8]);

    await processor.process(makeJob(0));

    expect(embeddings.embed).toHaveBeenCalledWith('hello world', { maxRetries: 0 });
    const [sql, ...values] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain("status = 'READY'");
    expect(values).toEqual(['[0.6,0.8]', 'doc-1']);
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('rethrows a transient error for BullMQ to retry and leaves the document PENDING', async () => {
    const error = apiError(429, 'Rate limit reached', true);
    embeddings.embed.mockRejectedValue(error);

    await expect(processor.process(makeJob(0))).rejects.toBe(error);
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('marks the document FAILED when a transient error happens on the last attempt', async () => {
    embeddings.embed.mockRejectedValue(apiError(429, 'Rate limit reached', true));

    await expect(processor.process(makeJob(2))).rejects.toThrow('Rate limit reached');
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'FAILED', error: 'Rate limit reached' },
    });
  });

  it.each([
    ['a rejected API key', apiError(401, 'Incorrect API key provided', false)],
    ['an input that is too long', apiError(400, 'Maximum context length is 8192 tokens', false)],
    ['a missing API key', new LoadAPIKeyError({ message: 'OpenAI API key is missing' })],
    ['an account without credits (a 429 the SDK calls retryable)', outOfCredits()],
  ])('fails fast on %s: FAILED on the first attempt, no retries', async (_, error) => {
    embeddings.embed.mockRejectedValue(error);

    const thrown = await processor.process(makeJob(0)).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(UnrecoverableError);
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'FAILED', error: error.message },
    });
  });

  it('skips a document that was deleted before it was processed', async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    await processor.process(makeJob(0));

    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
