"use client";

import { useMemo, useState } from 'react';

type GgufFile = {
  name: string;
  sizeBytes: number | null;
  sizeGB: number | null;
  downloadUrl: string;
};

type ModelSummary = {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  ggufFiles: GgufFile[];
};

type MachineSpecs = {
  platform: string;
  arch: string;
  cpuCores: number;
  totalMemoryBytes: number;
  totalMemoryGB: number;
  gpuName?: string;
  gpuMemoryBytes?: number;
  gpuMemoryGB?: number;
};

type Recommendation = {
  modelId: string;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  sizeGB: number | null;
  fit: 'excellent' | 'good' | 'tight' | 'too-large';
  reason: string;
};

type CatalogResponse = {
  success?: boolean;
  error?: string;
  query?: string;
  searched?: number;
  modelsFound?: number;
  machineSpecs?: MachineSpecs;
  recommendation?: Recommendation | null;
  models?: ModelSummary[];
};

function fitBadgeColor(fit: Recommendation['fit']): string {
  if (fit === 'excellent') return 'bg-emerald-500/20 text-emerald-300';
  if (fit === 'good') return 'bg-cyan-500/20 text-cyan-300';
  if (fit === 'tight') return 'bg-amber-500/20 text-amber-300';
  return 'bg-red-500/20 text-red-300';
}

export function ModelsCatalogCard() {
  const [query, setQuery] = useState('gguf');
  const [limit, setLimit] = useState('80');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CatalogResponse | null>(null);

  const models = useMemo(() => response?.models || [], [response]);

  const fetchCatalog = async () => {
    setLoading(true);
    setResponse(null);

    try {
      const params = new URLSearchParams({
        q: query || 'gguf',
        limit: limit || '80',
      });

      const res = await fetch(`/api/admin/models/gguf?${params.toString()}`, {
        method: 'GET',
      });

      const data = (await res.json().catch(() => ({}))) as CatalogResponse;
      if (!res.ok) {
        setResponse({ error: data.error || 'Failed to fetch GGUF models' });
      } else {
        setResponse(data);
      }
    } catch (error: any) {
      setResponse({ error: error?.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white/90">GGUF Catalog and Best-Fit Recommendation</p>
          <p className="text-xs text-white/50 mt-1">
            Fetch GGUF model details and get a recommendation based on this machine&apos;s hardware specs.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-white/55 mb-1.5">Search Query</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90"
            placeholder="gguf"
          />
        </div>
        <div>
          <label className="block text-xs text-white/55 mb-1.5">Limit</label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={fetchCatalog}
          disabled={loading}
          className="text-xs px-3.5 py-1.5 rounded-full border border-white/15 text-white/90 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          {loading ? 'Fetching...' : 'Fetch GGUF Models'}
        </button>
      </div>

      {response?.error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {response.error}
        </div>
      )}

      {response?.machineSpecs && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
            <p className="text-white/50">CPU Cores</p>
            <p className="text-white/85 font-medium mt-0.5">{response.machineSpecs.cpuCores}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
            <p className="text-white/50">RAM</p>
            <p className="text-white/85 font-medium mt-0.5">{response.machineSpecs.totalMemoryGB} GB</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
            <p className="text-white/50">GPU</p>
            <p className="text-white/85 font-medium mt-0.5">{response.machineSpecs.gpuName || 'Not detected'}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
            <p className="text-white/50">GPU VRAM</p>
            <p className="text-white/85 font-medium mt-0.5">{response.machineSpecs.gpuMemoryGB ? `${response.machineSpecs.gpuMemoryGB} GB` : '-'}</p>
          </div>
        </div>
      )}

      {response?.recommendation && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-white/55">Recommended</p>
            <span className={`text-[11px] px-2 py-1 rounded-full ${fitBadgeColor(response.recommendation.fit)}`}>
              {response.recommendation.fit}
            </span>
          </div>
          <p className="mt-1 text-sm text-white/90 font-semibold">{response.recommendation.modelId}</p>
          <p className="text-xs text-white/70 mt-0.5">{response.recommendation.fileName}</p>
          <p className="text-xs text-white/60 mt-1">Size: {response.recommendation.sizeGB ?? '-'} GB</p>
          <p className="text-xs text-white/50 mt-1">{response.recommendation.reason}</p>
        </div>
      )}

      {models.length > 0 && (
        <div className="mt-4 space-y-3 max-h-[56vh] overflow-y-auto pr-1 custom-scrollbar">
          {models.map((model) => (
            <div key={model.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/90 truncate">{model.id}</p>
                  <p className="text-[11px] text-white/55 mt-0.5">
                    by {model.author || 'unknown'} • downloads {model.downloads || 0} • likes {model.likes || 0}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {model.ggufFiles.map((file) => (
                  <div key={`${model.id}-${file.name}`} className="rounded-xl border border-white/10 bg-[#0f0f0f] px-2.5 py-2">
                    <p className="text-xs text-white/85 break-all">{file.name}</p>
                    <p className="text-[11px] text-white/55 mt-1">{file.sizeGB ? `${file.sizeGB} GB` : 'size unknown'}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
