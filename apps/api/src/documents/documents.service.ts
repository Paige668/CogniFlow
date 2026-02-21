import { Injectable } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PrismaService } from '../prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('documents') private documentsQueue: Queue
  ) { }

  async create(createDocumentDto: CreateDocumentDto, file?: Express.Multer.File) {
    let content = createDocumentDto.content || '';

    // Simple mock of file processing - in real app this goes to Queue
    if (file) {
      // Check if it's a text-based file
      const textMimeTypes = ['text/plain', 'text/markdown', 'application/json'];
      if (textMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
        content = file.buffer.toString('utf-8');
      } else {
        // For binary files (PDF, DOC, etc.), use placeholder text
        // In production, you would use proper parsers (pdf-parse, mammoth, etc.)
        content = `[Binary file: ${file.originalname}] - Content extraction not implemented yet. File size: ${file.size} bytes.`;
      }
    }

    const doc = await this.prisma.document.create({
      data: {
        content,
        metadata: {
          originalName: file?.originalname,
          size: file?.size,
          mimeType: file?.mimetype
        }
      }
    });

    // Add job to queue for advanced processing (embedding)
    await this.documentsQueue.add('process-document', {
      documentId: doc.id,
      content: doc.content
    });

    return doc;
  }

  findAll() {
    return this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: string) {
    return this.prisma.document.findUnique({ where: { id } });
  }

  update(id: string, updateDocumentDto: UpdateDocumentDto) {
    return `This action updates a #${id} document`;
  }

  remove(id: string) {
    return this.prisma.document.delete({ where: { id } });
  }
}
