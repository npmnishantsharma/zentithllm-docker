import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { LocalModelEditor } from '@/components/admin/LocalModelEditor';
import { ModelAccessManager } from '@/components/admin/ModelAccessManager';
import { getSessionUser } from '@/lib/session';

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

async function getLocalModel(name: string): Promise<LocalModelEntry | null> {
  const modelsDir = path.join(process.cwd(), 'models');
  const entries = await readdir(modelsDir, { withFileTypes: true }).catch(() => []);
  const match = entries.find((entry) => entry.isFile() && entry.name === name);
  if (!match) return null;

  const filePath = path.join(modelsDir, match.name);
  const fileStat = await stat(filePath);
  return {
    name: match.name,
    sizeBytes: fileStat.size,
    sizeReadable: formatBytes(fileStat.size),
    modifiedAt: fileStat.mtime.toISOString(),
  };
}

export default async function LocalModelEditPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/login');
  }

  if (!sessionUser.isAdmin) {
    redirect('/chat');
  }

  const resolvedParams = await params;
  const decodedName = decodeURIComponent(resolvedParams.name || '').trim();
  const model = await getLocalModel(decodedName);

  if (!model) {
    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
        <AdminSidebar sessionUser={sessionUser} active="models" />
        <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden border border-white/10 m-[10px] rounded-2xl">
          <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
            <div>
              <h1 className="text-sm font-semibold text-white/90">Edit Model</h1>
              <p className="text-[11px] text-white/40 truncate">{decodedName}</p>
            </div>
            <Link
              href="/admin/models"
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
            >
              Back to Local Models
            </Link>
          </header>

          <div className="p-6">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Local model not found.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      <AdminSidebar sessionUser={sessionUser} active="models" />

      <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden border border-white/10 m-[10px] rounded-2xl">
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
          <div>
            <h1 className="text-sm font-semibold text-white/90">Edit Model</h1>
            <p className="text-[11px] text-white/40 truncate">{model.name}</p>
          </div>
          <Link
            href="/admin/models"
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
          >
            Back to Local Models
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
            <LocalModelEditor model={model} />
            <ModelAccessManager />
          </div>
        </div>
      </main>
    </div>
  );
}
