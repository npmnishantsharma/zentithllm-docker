"use client";

import { useState } from 'react';

type DownloadResult = {
  success?: boolean;
  error?: string;
  path?: string;
  bytes?: number;
  savedAs?: string;
};

type ModelFileDownloadButtonProps = {
  repoId: string;
  filename: string;
  revision?: string;
  targetName: string;
  downloadUrl?: string;
};

export function ModelFileDownloadButton({ repoId, filename, revision = 'main', targetName, downloadUrl }: ModelFileDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DownloadResult | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/models/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoId,
          filename,
          revision,
          targetName,
          url: downloadUrl,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as DownloadResult;

      if (!response.ok || !data.success) {
        setResult({ error: data.error || 'Download failed' });
        return;
      }

      setResult(data);
    } catch (error: any) {
      setResult({ error: error?.message || 'Download failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="text-[10px] px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-white/85 hover:bg-white/10 transition-colors disabled:opacity-40"
      >
        {loading ? 'Saving...' : 'Save to /models'}
      </button>
      {result?.success && result.path && (
        <span className="text-[10px] text-emerald-300 text-right max-w-[180px] truncate">
          Saved {result.path}
        </span>
      )}
      {result?.error && (
        <span className="text-[10px] text-red-300 text-right max-w-[180px] truncate">
          {result.error}
        </span>
      )}
    </div>
  );
}
