"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type UploadResponse = {
  success?: boolean;
  error?: string;
  model?: {
    name: string;
    sizeBytes: number;
    sizeReadable: string;
    modifiedAt: string;
  };
};

export function ModelActionsFab() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gguf')) {
      setError('Only .gguf files are supported');
      event.target.value = '';
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/models/local/upload', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json().catch(() => ({}))) as UploadResponse;
      if (!response.ok || !data.success || !data.model?.name) {
        throw new Error(data.error || 'Upload failed');
      }

      setOpen(false);
      router.push(`/admin/models/local/${encodeURIComponent(data.model.name)}`);
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Upload failed');
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
        {open && (
          <div className="w-[260px] rounded-2xl border border-white/10 bg-[#101010] p-3 shadow-2xl">
            <p className="text-xs text-white/70 mb-2">Add model</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              >
                {uploading ? 'Uploading...' : 'Upload GGUF file'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push('/admin/models/discover');
                }}
                className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-left text-sm text-white/90 hover:bg-white/[0.08] transition-colors"
              >
                Get from Hugging Face
              </button>
            </div>

            {error && (
              <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-200">
                {error}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen((current) => !current);
          }}
          className="h-14 w-14 rounded-full border border-cyan-400/30 bg-cyan-500/20 text-3xl leading-none text-cyan-100 hover:bg-cyan-500/30 transition-colors"
          aria-label="Add model"
          title="Add model"
        >
          +
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".gguf"
        className="hidden"
        onChange={handleFileSelected}
      />
    </>
  );
}
