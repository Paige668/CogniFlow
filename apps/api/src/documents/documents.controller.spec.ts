import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import type { TextStreamPart, ToolSet } from 'ai';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AgentService } from './agent.service';

type Part = TextStreamPart<ToolSet>;

const text = (t: string) => ({ type: 'text-delta', id: '1', text: t }) as Part;
const toolCall = () =>
  ({ type: 'tool-call', toolName: 'search_knowledge_base' }) as unknown as Part;
const errorPart = (error: unknown) => ({ type: 'error', error }) as Part;

async function* stream(parts: Part[]) {
  for (const part of parts) yield part;
}

// Records what the controller does to the response, in order.
function makeResponse() {
  const calls: string[] = [];
  const res: Record<string, jest.Mock> = {
    status: jest.fn((code: number) => {
      calls.push(`status ${code}`);
      return res;
    }),
    setHeader: jest.fn(),
    write: jest.fn((chunk: string) => {
      calls.push(`write ${chunk}`);
      return true;
    }),
    end: jest.fn(() => calls.push('end')),
    destroy: jest.fn(() => calls.push('destroy')),
    json: jest.fn((body: unknown) =>
      calls.push(`json ${JSON.stringify(body)}`),
    ),
  };
  return { res: res as unknown as Response, calls };
}

describe('DocumentsController chat', () => {
  let controller: DocumentsController;
  let agent: { chat: jest.Mock };

  beforeEach(async () => {
    agent = { chat: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: {} },
        { provide: AgentService, useValue: agent },
      ],
    }).compile();
    controller = moduleRef.get(DocumentsController);
    // Keep expected error logs out of the test output.
    jest.spyOn(controller['logger'], 'error').mockImplementation();
    jest.spyOn(controller['logger'], 'warn').mockImplementation();
  });

  const chat = (res: Response) =>
    controller.chat(
      { messages: [{ role: 'user', content: 'hi' }] } as any,
      res,
    );

  it('streams the answer text with a 200 and ends the response', async () => {
    agent.chat.mockResolvedValue({
      fullStream: stream([toolCall(), text('Hello'), text(' world')]),
    });
    const { res, calls } = makeResponse();

    await chat(res);

    expect(calls).toEqual(['status 200', 'write Hello', 'write  world', 'end']);
  });

  it('returns a 502 with a generic message when the provider fails before any text', async () => {
    agent.chat.mockResolvedValue({
      fullStream: stream([
        errorPart(new Error('insufficient_quota: secret details')),
      ]),
    });
    const { res, calls } = makeResponse();

    await chat(res);

    expect(calls).toEqual([
      'status 502',
      `json ${JSON.stringify({ message: 'The assistant could not get an answer from the AI model. Please try again later.' })}`,
    ]);
    expect(calls.join()).not.toContain('secret details');
  });

  it('returns a 502 when the agent throws before streaming starts', async () => {
    agent.chat.mockRejectedValue(new Error('boom'));
    const { res, calls } = makeResponse();

    await chat(res);

    expect(calls[0]).toBe('status 502');
  });

  it('destroys the response when the provider fails mid-answer, so the client cannot mistake it for a full answer', async () => {
    agent.chat.mockResolvedValue({
      fullStream: stream([
        text('Partial'),
        errorPart(new Error('connection reset')),
      ]),
    });
    const { res, calls } = makeResponse();

    await chat(res);

    expect(calls).toEqual(['status 200', 'write Partial', 'destroy']);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('returns a 502 when the stream finishes without any answer text', async () => {
    agent.chat.mockResolvedValue({ fullStream: stream([toolCall()]) });
    const { res, calls } = makeResponse();

    await chat(res);

    expect(calls).toEqual([
      'status 502',
      `json ${JSON.stringify({ message: 'The AI model returned an empty answer.' })}`,
    ]);
  });
});
