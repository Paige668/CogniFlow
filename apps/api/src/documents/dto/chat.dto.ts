import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class ChatDto {
    @IsArray()
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}
