import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, unlink, rename } from 'fs/promises';
import path from 'path';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LocalModelEntry = {
  name: string;
  sizeBytes: number;
  sizeReadable: string;
  modifiedAt: string;
};

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

function getModelsDir(): string {
  return path.join(process.cwd(), 'models');
}

async function listLocalModels(): Promise<LocalModelEntry[]> {
  const modelsDir = getModelsDir();

  const entries = await readdir(modelsDir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.gguf'));

  const results = await Promise.all(
    files.map(async (entry) => {
      const fullPath = path.join(modelsDir, entry.name);
      const fileStat = await stat(fullPath);
      return {
        name: entry.name,
        sizeBytes: fileStat.size,
        sizeReadable: formatBytes(fileStat.size),
        modifiedAt: fileStat.mtime.toISOString(),
      } satisfies LocalModelEntry;
    })
  );

  return results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function isSafeFileName(fileName: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(fileName);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const models = await listLocalModels();
    const url = new URL(req.url);
    const requestedName = (url.searchParams.get('name') || '').trim();

    if (requestedName) {
      if (!isSafeFileName(requestedName)) {
        return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
      }

      const model = models.find((entry) => entry.name === requestedName);
      if (!model) {
        return NextResponse.json({ error: 'Model not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, model });
    }

    return NextResponse.json({ success: true, models });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to list local models' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { currentName?: string; newName?: string };
  const currentName = (body.currentName || '').trim();
  const newNameInput = (body.newName || '').trim();
  const newName = newNameInput.toLowerCase().endsWith('.gguf') ? newNameInput : `${newNameInput}.gguf`;

  if (!currentName || !newNameInput) {
    return NextResponse.json({ error: 'currentName and newName are required' }, { status: 400 });
  }

  if (!isSafeFileName(currentName) || !isSafeFileName(newName)) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }

  if (!newName.toLowerCase().endsWith('.gguf')) {
    return NextResponse.json({ error: 'Only .gguf files are supported' }, { status: 400 });
  }

  const modelsDir = getModelsDir();
  const fromPath = path.join(modelsDir, currentName);
  const toPath = path.join(modelsDir, newName);

  try {
    await rename(fromPath, toPath);
    return NextResponse.json({ success: true, renamed: { from: currentName, to: newName } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to rename local model' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || '').trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!isSafeFileName(name)) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }

  try {
    const filePath = path.join(getModelsDir(), name);
    await unlink(filePath);
    return NextResponse.json({ success: true, deleted: name });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete local model' }, { status: 500 });
  }
}
