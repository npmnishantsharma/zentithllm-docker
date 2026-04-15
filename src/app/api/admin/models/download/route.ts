import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { ModelAccessService } from '@/lib/database';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DownloadRequestBody = {
  repoId?: string;
  filename?: string;
  revision?: string;
  targetName?: string;
  token?: string;
  url?: string;
};

function sanitizeTargetName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isValidRepoId(value: string): boolean {
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(value);
}

function isValidHuggingFaceUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'huggingface.co' && parsed.pathname.includes('/resolve/');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as DownloadRequestBody;

  const canAccessModels = await ModelAccessService.canUserAccessModels({
    userId: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
  });

  if (!canAccessModels) {
    return NextResponse.json({ error: 'You are not allowed to access model downloads' }, { status: 403 });
  }

  const effectiveRateLimit = await ModelAccessService.getEffectiveRateLimit({
    userId: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
  });

  const rateCheck = await ModelAccessService.consumeRateLimit(
    user.id,
    effectiveRateLimit.limit,
    effectiveRateLimit.windowMinutes
  );

  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit reached. Try again after the current ${effectiveRateLimit.windowMinutes} minute window resets.`,
      },
      { status: 429 }
    );
  }
  const repoId = (body.repoId || '').trim();
  const filename = (body.filename || '').trim();
  const revision = 'main';
  const token = (body.token || '').trim();
  const directUrl = (body.url || '').trim();

  if (directUrl) {
    const allowDirectHfUrl = await ModelAccessService.canUseDirectHuggingFaceUrl();
    if (!allowDirectHfUrl) {
      return NextResponse.json({ error: 'Direct Hugging Face URL downloads are disabled by admin policy' }, { status: 403 });
    }
  }

  const safeTargetName = sanitizeTargetName((body.targetName || path.basename(filename || directUrl)).trim() || 'model.gguf');
  const modelsDir = path.join(process.cwd(), 'models');
  const targetPath = path.join(modelsDir, safeTargetName);

  try {
    await mkdir(modelsDir, { recursive: true });

    let url = directUrl;

    if (url) {
      if (!isValidHuggingFaceUrl(url)) {
        return NextResponse.json({ error: 'url must be a valid huggingface.co resolve URL' }, { status: 400 });
      }
    } else {
      if (!repoId || !filename) {
        return NextResponse.json({ error: 'repoId and filename are required' }, { status: 400 });
      }

      if (!isValidRepoId(repoId)) {
        return NextResponse.json(
          { error: 'repoId must be in format owner/model' },
          { status: 400 }
        );
      }

      url = `https://huggingface.co/${encodeURIComponent(repoId).replace('%2F', '/')}/resolve/${encodeURIComponent(revision)}/${filename
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/')}`;
    }

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
