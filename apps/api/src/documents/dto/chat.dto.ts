import { IsArray } from 'class-validator';

export class ChatDto {
  @IsArray()
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}
