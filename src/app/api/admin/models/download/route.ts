import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DownloadRequestBody = {
  repoId?: string;
  filename?: string;
  revision?: string;
  targetName?: string;
  token?: string;
};

function sanitizeTargetName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isValidRepoId(value: string): boolean {
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(value);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as DownloadRequestBody;
  const repoId = (body.repoId || '').trim();
  const filename = (body.filename || '').trim();
  const revision = (body.revision || 'main').trim() || 'main';
  const token = (body.token || '').trim();

  if (!repoId || !filename) {
    return NextResponse.json({ error: 'repoId and filename are required' }, { status: 400 });
  }

  if (!isValidRepoId(repoId)) {
    return NextResponse.json(
      { error: 'repoId must be in format owner/model' },
      { status: 400 }
    );
  }

  const safeTargetName = sanitizeTargetName((body.targetName || path.basename(filename)).trim() || 'model.gguf');
  const modelsDir = path.join(process.cwd(), 'models');
  const targetPath = path.join(modelsDir, safeTargetName);

  try {
    await mkdir(modelsDir, { recursive: true });

    const url = `https://huggingface.co/${encodeURIComponent(repoId).replace('%2F', '/')}/resolve/${encodeURIComponent(revision)}/${filename
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      const details = await response.text().catch(() => 'Unable to download from Hugging Face');
      return NextResponse.json(
        { error: `Download failed (${response.status}): ${details.slice(0, 500)}` },
        { status: response.status >= 400 ? response.status : 502 }
      );
    }

    const fileStream = createWriteStream(targetPath, { flags: 'w' });
    await pipeline(Readable.fromWeb(response.body as any), fileStream);

    const fileStat = await stat(targetPath);

    return NextResponse.json({
      success: true,
      repoId,
      revision,
      filename,
      savedAs: safeTargetName,
      path: `models/${safeTargetName}`,
      bytes: fileStat.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Download failed' },
      { status: 500 }
    );
  }
}
