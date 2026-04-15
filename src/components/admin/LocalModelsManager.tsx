"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

type LocalModelEntry = {
  name: string;
  sizeBytes: number;
  sizeReadable: string;
  modifiedAt: string;
};

type LocalModelsResponse = {
  success?: boolean;
  error?: string;
  models?: LocalModelEntry[];
};

export function LocalModelsManager() {
  const [models, setModels] = useState<LocalModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModels = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/models/local', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as LocalModelsResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load local models');
      }

      setModels(data.models || []);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load local models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModels();
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white/90">Local Model Manager</p>
          <p className="text-xs text-white/50 mt-1">
            Click a local GGUF model to open its edit page.
          </p>
        </div>
        <button
          type="button"
          onClick={loadModels}
          disabled={loading}
          className="text-xs px-3.5 py-1.5 rounded-full border border-white/15 text-white/90 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
        {loading && models.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
            Loading local models...
          </div>
        ) : null}

        {!loading && models.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
            No local models found in models/.
          </div>
        ) : null}

        {models.map((model) => (
          <Link
            key={model.name}
            href={`/admin/models/local/${encodeURIComponent(model.name)}`}
            className="block rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90 truncate">{model.name}</p>
                <p className="text-[11px] text-white/55 mt-0.5">
                  {model.sizeReadable} • updated {new Date(model.modifiedAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/80">
                Edit
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
