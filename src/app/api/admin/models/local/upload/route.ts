import { NextResponse } from 'next/server';
import { mkdir, writeFile, stat } from 'fs/promises';
import path from 'path';
import { ModelAccessService } from '@/lib/database';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canAccessModels = await ModelAccessService.canUserAccessModels({
    userId: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
  });

  if (!canAccessModels) {
    return NextResponse.json({ error: 'You are not allowed to upload models' }, { status: 403 });
  }

  const allowManualUpload = await ModelAccessService.canUseManualUpload();
  if (!allowManualUpload) {
    return NextResponse.json({ error: 'Manual model uploads are disabled by admin policy' }, { status: 403 });
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

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const sourceName = (file.name || '').trim();
    const safeName = sanitizeFileName(sourceName);
    if (!safeName || !safeName.toLowerCase().endsWith('.gguf')) {
      return NextResponse.json({ error: 'Only .gguf files are supported' }, { status: 400 });
    }

    const maxUploadBytes = await ModelAccessService.getMaxUploadSizeBytes();
    if (maxUploadBytes > 0 && file.size > maxUploadBytes) {
      const maxMb = Math.round(maxUploadBytes / 1024 / 1024);
      return NextResponse.json(
        { error: `File is too large. Max upload size is ${maxMb} MB` },
        { status: 413 }
      );
    }

    const modelsDir = path.join(process.cwd(), 'models');
    await mkdir(modelsDir, { recursive: true });

    const targetPath = path.join(modelsDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, buffer);

    const fileStat = await stat(targetPath);

    return NextResponse.json({
      success: true,
      model: {
        name: safeName,
        sizeBytes: fileStat.size,
        sizeReadable: formatBytes(fileStat.size),
        modifiedAt: fileStat.mtime.toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to upload model' }, { status: 500 });
  }
}
