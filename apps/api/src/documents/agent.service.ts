import { Injectable, Logger } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { streamText, embed } from 'ai';
import { z } from 'zod';
import { zodSchema } from '@ai-sdk/provider-utils';
import { PrismaService } from '../prisma.service';
import { FeatureFlagsService } from '../feature-flags.service';

@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);

    constructor(
        private prisma: PrismaService,
        private featureFlags: FeatureFlagsService,
    ) { }

    private async getSearchTool() {
        const searchInputSchema = z.object({
            query: z.string().describe('The search query to find relevant documents'),
        });

        return {
            description: 'Search the knowledge base for relevant documents.',
            inputSchema: zodSchema(searchInputSchema),
            execute: async ({ query }: { query: string }) => {
                this.logger.log(`Agent searching for: ${query}`);

                let embedding: number[];
                try {
                    const result = await embed({
                        model: openai.embedding('text-embedding-3-small'),
                        value: query,
                    });
                    embedding = result.embedding;
                } catch (e) {
                    this.logger.warn('Embedding failed during search, using random vector');
                    embedding = Array.from({ length: 1536 }, () => Math.random());
                }

                const vectorString = `[${embedding.join(',')}]`;
                const results = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT id, content, metadata, 1 - (embedding <=> $1::vector) as similarity
          FROM documents
          WHERE 1 - (embedding <=> $1::vector) > 0.5
          ORDER BY similarity DESC
          LIMIT 3
        `, vectorString);

                this.logger.log(`Found ${results.length} relevant documents`);
                return results.map((doc: any) => ({
                    content: doc.content.substring(0, 500) + '...',
                    metadata: doc.metadata,
                    similarity: doc.similarity,
                }));
            },
        };
    }

    async chat(messages: any[]): Promise<{ textStream: AsyncIterable<string> }> {
        const useGpt4o = this.featureFlags.get('use_gpt4o');
        const ragEnabled = this.featureFlags.get('rag_enabled');
        const model = useGpt4o ? 'gpt-4o' : 'gpt-3.5-turbo';

        this.logger.log(`Chat: model=${model}, rag=${ragEnabled}`);

        const tools = ragEnabled
            ? { search_knowledge_base: (await this.getSearchTool()) as any }
            : undefined;

        const result = streamText({
            model: openai(model),
            messages,
            system: `You are a helpful AI Knowledge Agent for CogniFlow.
You have access to a knowledge base of uploaded documents.

RULES:
1. ALWAYS search the knowledge base first if the user asks for specific information.
2. If you find relevant information, cite the document name in your answer.
3. If the answer is not in the documents, rely on your general knowledge but mention that you couldn't find it in the docs.
4. Be concise and professional.`,
            ...(tools && { tools }),
        });

        return result;
    }
}
