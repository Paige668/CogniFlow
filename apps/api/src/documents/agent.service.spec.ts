import { Test } from '@nestjs/testing';
import type { Tool } from 'ai';
import { AgentService } from './agent.service';
import { PrismaService } from '../prisma.service';
import { EmbeddingService } from '../embedding.service';
import { FeatureFlagsService } from '../feature-flags.service';

describe('AgentService search tool', () => {
  let agent: AgentService;
  let prisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EmbeddingService,
          useValue: { embed: jest.fn().mockResolvedValue([0.6, 0.8]) },
        },
        { provide: FeatureFlagsService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    agent = moduleRef.get(AgentService);
    jest.spyOn(agent['logger'], 'log').mockImplementation();
  });

  const search = (userId: string, query: string) => {
    const tool = agent['getSearchTool'](userId) as Tool<{ query: string }>;
    return tool.execute!(
      { query },
      { toolCallId: 'call-1', messages: [] },
    ) as Promise<unknown>;
  };

  it("searches only the caller's documents, with the owner bound as a parameter", async () => {
    await search('user_a', 'deadlines');

    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(params).toEqual(['[0.6,0.8]', 'user_a']);
    expect(sql).toContain('"userId" = $2');
  });

  it('filters by owner before ranking, so LIMIT 3 picks among the caller’s documents', async () => {
    await search('user_a', 'deadlines');

    const [sql] = prisma.$queryRawUnsafe.mock.calls[0] as [string];
    // The owner filter is in the WHERE clause, which runs before ORDER BY ... LIMIT.
    const where = sql.indexOf('WHERE');
    const owner = sql.indexOf('"userId" = $2');
    const orderBy = sql.indexOf('ORDER BY');
    expect(where).toBeGreaterThan(-1);
    expect(owner).toBeGreaterThan(where);
    expect(owner).toBeLessThan(orderBy);
  });

  it('never puts the user ID into the SQL text itself', async () => {
    await search("user_a' OR '1'='1", 'deadlines');

    const [sql] = prisma.$queryRawUnsafe.mock.calls[0] as [string];
    expect(sql).not.toContain('user_a');
  });
});
