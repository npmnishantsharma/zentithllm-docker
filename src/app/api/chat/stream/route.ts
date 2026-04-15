import { NextRequest, NextResponse } from 'next/server';
import { getLlama, LlamaChatSession, type LlamaContext, type LlamaModel } from 'node-llama-cpp';
import { stat } from 'fs/promises';
import path from 'path';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatChunk = {
  text: string;
  type?: string;
  segmentType?: string;
  startTime?: number;
  endTime?: number;
};

let llama: any = null;
let llamaModel: LlamaModel | null = null;
let loadedModelPath: string | null = null;
let initPromise: Promise<void> | null = null;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function resolveModelPath(modelPath?: string): string | null {
  const candidate = modelPath || process.env.LLAMA_MODEL_PATH || null;
  if (!candidate) return null;

  if (path.isAbsolute(candidate)) {
    return candidate;
  }

  return path.join(process.cwd(), candidate);
}

function isSafeModelPath(resolvedPath: string): boolean {
  const modelsDir = path.join(process.cwd(), 'models');
  const normalizedModelsDir = path.resolve(modelsDir);
  const normalizedTarget = path.resolve(resolvedPath);

  return normalizedTarget.startsWith(normalizedModelsDir + path.sep) && normalizedTarget.toLowerCase().endsWith('.gguf');
}

async function modelFileExists(resolvedPath: string): Promise<boolean> {
  try {
    const file = await stat(resolvedPath);
    return file.isFile();
  } catch {
    return false;
  }
}

function buildPrompt(prompt: string, messages: ChatMessage[]): string {
  if (!messages.length) return prompt;

  const serialized = messages
    .filter((m) => m && typeof m.content === 'string' && !!m.content.trim())
    .map((m) => {
      const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
      return `${role}: ${m.content.trim()}`;
    })
    .join('\n');

  return `${serialized}\nuser: ${prompt}`;
}

async function initModel(modelPath: string): Promise<void> {
  if (llamaModel && loadedModelPath === modelPath) {
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    llama = await getLlama();
    const model = await llama.loadModel({ modelPath, gpuLayers: 'max' });
    if (!model) {
      throw new Error('Failed to load model');
    }

    llamaModel = model;
    loadedModelPath = modelPath;
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

function toSseEvent(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function normalizeResponse(responseItems: any[]): Array<string | Record<string, unknown>> {
  return responseItems.map((item: any) => {
    if (typeof item === 'string') {
      return item;
    }

    if (item?.type === 'segment') {
      return {
        type: 'segment',
        segmentType: item.segmentType,
        text: item.text,
        startTime: item.startTime,
        endTime: item.endTime,
      };
    }

    return '';
  });
}

type StreamPayload = {
  prompt: string;
  messages: ChatMessage[];
  requestId: string;
  modelPath: string | null;
  maxTokens: number;
  temperature: number;
  topP: number;
  contextSize: number;
  batchSize: number;
};

async function streamChat(req: NextRequest, payload: StreamPayload) {
  const {
    prompt,
    messages,
    requestId,
    modelPath,
    maxTokens,
    temperature,
    topP,
    contextSize,
    batchSize,
  } = payload;

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  if (!modelPath) {
    return NextResponse.json(
      { error: 'Missing model path. Provide modelPath in body or LLAMA_MODEL_PATH env var.' },
      { status: 400 }
    );
  }

  if (!isSafeModelPath(modelPath)) {
    return NextResponse.json(
      { error: 'modelPath must point to a .gguf file inside models/' },
      { status: 400 }
    );
  }

  const exists = await modelFileExists(modelPath);
  if (!exists) {
    return NextResponse.json(
      { error: 'Model file not found' },
      { status: 404 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let requestContext: LlamaContext | null = null;
      let closed = false;

      const write = (event: string, payload: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(toSseEvent(event, payload)));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const onAbort = () => {
        close();
      };

      req.signal.addEventListener('abort', onAbort, { once: true });

      try {
        await initModel(modelPath);
        if (!llamaModel) {
          throw new Error('Model failed to initialize');
        }

        write('ready', { requestId });

        requestContext = await llamaModel.createContext({
          contextSize,
          batchSize,
        });

        const chatSession = new LlamaChatSession({
          contextSequence: requestContext.getSequence(),
        });

        const answer = await chatSession.promptWithMeta(buildPrompt(prompt, messages), {
          maxTokens,
          temperature,
          topP,
          onResponseChunk(chunk: any) {
            const processedChunk: ChatChunk = { text: chunk?.text || '' };

            if (chunk?.type === 'segment') {
              processedChunk.type = 'segment';
              processedChunk.segmentType = chunk.segmentType;

              if (chunk.segmentStartTime != null) {
                processedChunk.startTime = chunk.segmentStartTime;
              }

              if (chunk.segmentEndTime != null) {
                processedChunk.endTime = chunk.segmentEndTime;
              }
            }

            write('chunk', {
              type: 'chunk',
              chunk: processedChunk,
              requestId,
            });
          },
        });

        const fullResponse = normalizeResponse(answer.response || []);
        write('done', {
          type: 'done',
          response: fullResponse,
          requestId,
        });
      } catch (error: any) {
        write('error', {
          type: 'error',
          error: String(error?.message || error),
          requestId,
        });
      } finally {
        req.signal.removeEventListener('abort', onAbort);
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const parsedMessages = Array.isArray(body?.messages)
    ? body.messages
        .map((m: any) => ({
          role: m?.role,
          content: typeof m?.content === 'string' ? m.content : '',
        }))
        .filter((m: any) => ['system', 'user', 'assistant'].includes(m.role) && m.content.trim().length > 0)
    : [];

  return streamChat(req, {
    prompt: typeof body?.prompt === 'string' ? body.prompt.trim() : '',
    messages: parsedMessages,
    requestId: typeof body?.requestId === 'string' && body.requestId.trim().length > 0
      ? body.requestId.trim()
      : globalThis.crypto.randomUUID(),
    modelPath: resolveModelPath(typeof body?.modelPath === 'string' ? body.modelPath : undefined),
    maxTokens: Number.isFinite(body?.maxTokens) ? Number(body.maxTokens) : 512,
    temperature: Number.isFinite(body?.temperature) ? Number(body.temperature) : 0.7,
    topP: Number.isFinite(body?.topP) ? Number(body.topP) : 0.9,
    contextSize: Number.isFinite(body?.contextSize) ? Number(body.contextSize) : 1024,
    batchSize: Number.isFinite(body?.batchSize) ? Number(body.batchSize) : 512,
  });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  return streamChat(req, {
    prompt: (searchParams.get('prompt') || '').trim(),
    messages: [],
    requestId: (searchParams.get('requestId') || globalThis.crypto.randomUUID()).trim(),
    modelPath: resolveModelPath(searchParams.get('modelPath') || undefined),
    maxTokens: Number(searchParams.get('maxTokens')) || 512,
    temperature: Number(searchParams.get('temperature')) || 0.7,
    topP: Number(searchParams.get('topP')) || 0.9,
    contextSize: Number(searchParams.get('contextSize')) || 1024,
    batchSize: Number(searchParams.get('batchSize')) || 512,
  });
}
