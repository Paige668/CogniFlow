import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { PrismaService } from '../prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { ProcessDocumentJob } from './documents.processor';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('documents') private documentsQueue: Queue,
  ) {}

  // Every method takes the owner's Clerk user ID and puts it in the query itself, so a
  // document of another user is never loaded in the first place.

  async create(
    userId: string,
    createDocumentDto: CreateDocumentDto,
    file?: Express.Multer.File,
  ) {
    let content = createDocumentDto.content || '';

    // Simple mock of file processing - in real app this goes to Queue
    if (file) {
      // Check if it's a text-based file
      const textMimeTypes = ['text/plain', 'text/markdown', 'application/json'];
      if (
        textMimeTypes.includes(file.mimetype) ||
        file.mimetype.startsWith('text/')
      ) {
        content = file.buffer.toString('utf-8');
      } else {
        // For binary files (PDF, DOC, etc.), use placeholder text
        // In production, you would use proper parsers (pdf-parse, mammoth, etc.)
        content = `[Binary file: ${file.originalname}] - Content extraction not implemented yet. File size: ${file.size} bytes.`;
      }
    }

    const doc = await this.prisma.document.create({
      data: {
        userId,
        content,
        metadata: {
          originalName: file?.originalname,
          size: file?.size,
          mimeType: file?.mimetype,
        },
      },
    });

    // Queue embedding in the background; retries are configured on the queue (DocumentsQueueModule)
    const job: ProcessDocumentJob = { documentId: doc.id };
    await this.documentsQueue.add('process-document', job);

    return doc;
  }

  findAll(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    // Same 404 for "does not exist" and "belongs to someone else", so IDs of other
    // users' documents cannot be probed.
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(userId: string, id: string) {
    // The owner check and the delete are one statement, so nothing can change in between.
    const { count } = await this.prisma.document.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Document not found');
    return { id };
  }
}
