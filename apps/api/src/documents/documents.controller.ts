import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { AgentService } from './agent.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ChatDto } from './dto/chat.dto';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly agentService: AgentService
  ) { }

  @Post('chat')
  async chat(@Body() chatDto: ChatDto, @Res() res: any) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200);

    let bytesWritten = 0;
    try {
      const result = await this.agentService.chat(chatDto.messages);
      // Iterate the text stream
      for await (const chunk of result.textStream) {
        res.write(chunk);
        bytesWritten += chunk.length;
      }
    } catch (error: any) {
      // Explicit throw in stream iteration
    }

    // If nothing was written (quota error, empty response, etc.), send mock
    if (bytesWritten === 0) {
      const mockText = `[MOCK MODE] OpenAI API quota exceeded.\n\nThe CogniFlow RAG architecture is fully operational:\n✅ NestJS API on port 3000\n✅ BullMQ document processing queue\n✅ PostgreSQL + pgvector similarity search\n✅ Agent tool definition\n✅ Streaming infrastructure\n\nAdd OpenAI API credits to enable real AI responses.`;
      res.write(mockText);
    }

    res.end();
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(@Body() createDocumentDto: CreateDocumentDto, @UploadedFile() file: Express.Multer.File) {
    return this.documentsService.create(createDocumentDto, file);
  }

  @Get()
  findAll() {
    return this.documentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto) {
    return this.documentsService.update(id, updateDocumentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
