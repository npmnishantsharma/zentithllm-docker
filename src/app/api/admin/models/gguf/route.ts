import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ModelSummary = {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  tags?: string[];
  pipelineTag?: string;
  url: string;
};

function parseNextCursor(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
  if (!nextMatch?.[1]) return null;

  try {
    const nextUrl = new URL(nextMatch[1]);
    return nextUrl.searchParams.get('cursor');
  } catch {
    return null;
  }
}

function buildModelUrl(modelId: string): string {
  return `https://huggingface.co/${modelId}`;
}

function toModelSummary(raw: any): ModelSummary | null {
  if (!raw?.id) return null;

  return {
    id: String(raw.id),
    author: raw.author ? String(raw.author) : undefined,
    downloads: Number.isFinite(raw.downloads) ? Number(raw.downloads) : undefined,
    likes: Number.isFinite(raw.likes) ? Number(raw.likes) : undefined,
    lastModified: raw.lastModified ? String(raw.lastModified) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag: any) => String(tag)).filter(Boolean) : undefined,
    pipelineTag: raw.pipeline_tag ? String(raw.pipeline_tag) : undefined,
    url: buildModelUrl(String(raw.id)),
  };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const modelId = (searchParams.get('modelId') || '').trim();
  const query = (searchParams.get('q') || '').trim();
  const cursor = (searchParams.get('cursor') || '').trim();
  const requestedLimit = Number(searchParams.get('limit') || '200');
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1), 200);

  try {
    if (modelId) {
      const detailResponse = await fetch(
        `https://huggingface.co/api/models/${modelId}?blobs=true`,
        {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: req.signal,
        }
      );

      if (!detailResponse.ok) {
        const details = await detailResponse.text().catch(() => 'Failed to fetch model details');
        return NextResponse.json(
          { error: `Hugging Face model detail failed (${detailResponse.status}): ${details.slice(0, 300)}` },
          { status: 502 }
        );
      }

      const detailData = await detailResponse.json();
      return NextResponse.json({ success: true, model: detailData });
    }

    const params = new URLSearchParams({
      filter: 'gguf',
      sort: 'downloads',
      direction: '-1',
      limit: String(limit),
    });

    if (query) {
      params.set('search', query);
    }

    if (cursor) {
      params.set('cursor', cursor);
    }

    const response = await fetch(`https://huggingface.co/api/models?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: req.signal,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => 'Failed to fetch models');
      return NextResponse.json(
        { error: `Hugging Face model list failed (${response.status}): ${details.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const rawModels = (await response.json().catch(() => [])) as any[];
    const models = rawModels.map(toModelSummary).filter((item): item is ModelSummary => !!item);
    const nextCursor = parseNextCursor(response.headers.get('link'));

    return NextResponse.json({
      success: true,
      query,
      modelsFound: models.length,
      nextCursor,
      hasMore: Boolean(nextCursor),
      models,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch GGUF models' }, { status: 500 });
  }
}
