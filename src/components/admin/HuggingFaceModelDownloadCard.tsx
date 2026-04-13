"use client";

import { useState } from 'react';

type DownloadResponse = {
  success?: boolean;
  error?: string;
  path?: string;
  bytes?: number;
  savedAs?: string;
};

export function HuggingFaceModelDownloadCard() {
  const [repoId, setRepoId] = useState('');
  const [filename, setFilename] = useState('');
  const [revision, setRevision] = useState('main');
  const [targetName, setTargetName] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DownloadResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
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
          targetName: targetName || undefined,
          token: token || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as DownloadResponse;

      if (!response.ok) {
        setResult({ error: data.error || 'Download failed' });
        return;
      }

      setResult(data);
    } catch (error: any) {
      setResult({ error: error?.message || 'Request failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5 mt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white/90">Hugging Face Model Download</p>
          <p className="text-xs text-white/50 mt-1">
            Download a model file (for example a GGUF) into the local models directory.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-white/55 mb-1.5">Repository ID</label>
          <input
            type="text"
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            placeholder="TheBloke/Mistral-7B-Instruct-v0.2-GGUF"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs text-white/55 mb-1.5">Filename in Repo</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="mistral-7b-instruct-v0.2.Q4_K_M.gguf"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-white/55 mb-1.5">Revision</label>
          <input
            type="text"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="main"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>

        <div>
          <label className="block text-xs text-white/55 mb-1.5">Save As (optional)</label>
          <input
            type="text"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            placeholder="model.gguf"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs text-white/55 mb-1.5">Hugging Face Token (optional)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="hf_..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>

        <div className="sm:col-span-2 flex items-center justify-between">
          <p className="text-[11px] text-white/45">
            Files are saved under models/. Large model downloads can take several minutes.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="text-xs px-3.5 py-1.5 rounded-full border border-white/15 text-white/90 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Downloading...' : 'Download Model'}
          </button>
        </div>
      </form>

      {result?.error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {result.error}
        </div>
      )}

      {result?.success && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          Download complete: {result.path} ({result.bytes} bytes)
        </div>
      )}
    </div>
  );
}
