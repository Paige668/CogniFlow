import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { APICallError, LoadAPIKeyError, embed } from 'ai';

// Documents and queries must be embedded by the same model, or their vectors cannot be compared.
// Its 1536 dimensions are also fixed by the vector(1536) column in schema.prisma.
const EMBEDDING_MODEL = 'text-embedding-3-small';

@Injectable()
export class EmbeddingService {
    /** `maxRetries` is passed to the AI SDK; leave it unset to use the SDK default. */
    async embed(value: string, options: { maxRetries?: number } = {}): Promise<number[]> {
        const { embedding } = await embed({
            model: openai.embedding(EMBEDDING_MODEL),
            value,
            maxRetries: options.maxRetries,
        });
        return embedding;
    }
}

/**
 * True when retrying cannot help: the API key is missing, the account is out of credits,
 * or the provider rejected the request in a way it marks as not retryable (bad key, input too long, ...).
 */
export function isPermanentEmbeddingError(error: unknown): boolean {
    if (LoadAPIKeyError.isInstance(error)) return true;
    if (!APICallError.isInstance(error)) return false;
    // OpenAI answers both "slow down" and "out of credits" with a 429, which the SDK always marks
    // retryable. Only the error body tells them apart, and waiting will not add credits.
    const body = (error.data as { error?: { type?: string } } | undefined)?.error;
    if (body?.type === 'insufficient_quota') return true;
    return !error.isRetryable;
}
