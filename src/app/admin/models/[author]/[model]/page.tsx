import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

type ModelFile = {
  rfilename?: string;
  size?: number;
  blobId?: string;
  lfs?: {
    size?: number;
    sha256?: string;
    pointerSize?: number;
  };
};

type HuggingFaceModelDetail = {
  id?: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  pipeline_tag?: string;
  tags?: string[];
  siblings?: ModelFile[];
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default async function AdminModelDetailPage({
  params,
}: {
  params: Promise<{ author: string; model: string }>;
}) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/login');
  }

  if (!sessionUser.isAdmin) {
    redirect('/chat');
  }

  const resolvedParams = await params;
  const author = resolvedParams.author;
  const model = resolvedParams.model;
  const modelId = `${author}/${model}`;

  const detailResponse = await fetch(
    `https://huggingface.co/api/models/${modelId}?blobs=true`,
    {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }
  );

  if (!detailResponse.ok) {
    const details = await detailResponse.text().catch(() => 'Failed to fetch model details');
    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
        <AdminSidebar sessionUser={sessionUser} active="models" />
        <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden border border-white/10 m-[10px] rounded-2xl">
          <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
            <div>
              <h1 className="text-sm font-semibold text-white/90">Model Files</h1>
              <p className="text-[11px] text-white/40">{modelId}</p>
            </div>
            <Link
              href="/admin/models"
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
            >
              Back to Models
            </Link>
          </header>
          <div className="p-6">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Hugging Face model detail failed ({detailResponse.status}): {details.slice(0, 300)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const modelDetail = (await detailResponse.json()) as HuggingFaceModelDetail;
  const files = Array.isArray(modelDetail.siblings) ? modelDetail.siblings : [];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      <AdminSidebar sessionUser={sessionUser} active="models" />

      <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden border border-white/10 m-[10px] rounded-2xl">
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
          <div>
            <h1 className="text-sm font-semibold text-white/90">Model Files</h1>
            <p className="text-[11px] text-white/40 truncate">{modelId}</p>
          </div>
          <Link
            href="/admin/models"
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
          >
            Back to Models
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                  <p className="text-white/50">Author</p>
                  <p className="text-white/85 font-medium mt-0.5 truncate">{modelDetail.author || author}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                  <p className="text-white/50">Downloads</p>
                  <p className="text-white/85 font-medium mt-0.5">{modelDetail.downloads || 0}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                  <p className="text-white/50">Likes</p>
                  <p className="text-white/85 font-medium mt-0.5">{modelDetail.likes || 0}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                  <p className="text-white/50">Pipeline</p>
                  <p className="text-white/85 font-medium mt-0.5 truncate">{modelDetail.pipeline_tag || 'unknown'}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-white/55 mb-2">Files ({files.length})</p>
                {files.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] px-3 py-2 text-xs text-white/55">
                    No files found for this model.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1 custom-scrollbar">
                    {files.map((file) => {
                      const fileName = file.rfilename || 'unknown';
                      const size = typeof file.size === 'number' ? file.size : file.lfs?.size;
                      const isGguf = fileName.toLowerCase().endsWith('.gguf');

                      return (
                        <div key={file.blobId || fileName} className="rounded-2xl border border-white/10 bg-[#0f0f0f] px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs text-white/90 break-all">{fileName}</p>
                            {isGguf && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">
                                GGUF
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/50 mt-1">size {formatBytes(size)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
