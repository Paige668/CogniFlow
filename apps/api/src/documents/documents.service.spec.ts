import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma.service';

describe('DocumentsService ownership', () => {
  let service: DocumentsService;
  let prisma: {
    document: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      document: {
        create: jest.fn((args: { data: object }) => ({
          id: 'doc1',
          ...args.data,
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    queue = { add: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('documents'), useValue: queue },
      ],
    }).compile();
    service = moduleRef.get(DocumentsService);
  });

  it('stores an upload under the signed-in user', async () => {
    await service.create('user_a', { content: 'notes' });

    const [args] = prisma.document.create.mock.calls[0] as [
      { data: { userId: string; content: string } },
    ];
    expect(args.data).toMatchObject({ userId: 'user_a', content: 'notes' });
    expect(queue.add).toHaveBeenCalledWith('process-document', {
      documentId: 'doc1',
    });
  });

  it("lists only the caller's documents", async () => {
    await service.findAll('user_a');

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_a' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it("looks a document up by ID and owner, and returns 404 for another user's document", async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(service.findOne('user_b', 'doc1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc1', userId: 'user_b' },
    });
  });

  it('returns the document to its owner', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc1',
      userId: 'user_a',
    });

    await expect(service.findOne('user_a', 'doc1')).resolves.toEqual({
      id: 'doc1',
      userId: 'user_a',
    });
  });

  it("deletes with the owner in the same statement, and returns 404 when nothing of the caller's matched", async () => {
    prisma.document.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('user_b', 'doc1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({
      where: { id: 'doc1', userId: 'user_b' },
    });
  });

  it('deletes the caller’s own document', async () => {
    prisma.document.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.remove('user_a', 'doc1')).resolves.toEqual({
      id: 'doc1',
    });
  });
});
