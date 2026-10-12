import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { AgentService } from './agent.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ChatDto } from './dto/chat.dto';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly agentService: AgentService
  ) { }

  @Post('chat')
  async chat(@Body() chatDto: ChatDto, @Res() res: Response) {
    // Headers are sent with the first piece of answer text, so an error before that
    // can still get a real HTTP error status instead of a 200 with no answer.
    let started = false;

    try {
      const result = await this.agentService.chat(chatDto.messages);
      // fullStream reports model and provider errors as 'error' parts; textStream would skip them silently.
      for await (const part of result.fullStream) {
        if (part.type === 'error') throw part.error;
        if (part.type !== 'text-delta') continue;

        if (!started) {
          res.status(200);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Transfer-Encoding', 'chunked');
          res.setHeader('Cache-Control', 'no-cache');
          started = true;
        }
        res.write(part.text);
      }
    } catch (error) {
      this.logger.error(
        `Chat failed ${started ? 'mid-answer' : 'before any answer text'}: ${error instanceof Error ? error.message : error}`,
      );
      if (started) {
        // The 200 and part of the answer are already sent. Destroying the socket ends the chunked
        // response without its final chunk, so the client sees a failed read, not a finished answer.
        res.destroy();
        return;
      }
      // Provider details stay in the log; the client only learns what happened.
      res.status(502).json({ message: 'The assistant could not get an answer from the AI model. Please try again later.' });
      return;
    }

    if (!started) {
      this.logger.warn('Chat finished without any answer text');
      res.status(502).json({ message: 'The AI model returned an empty answer.' });
      return;
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
