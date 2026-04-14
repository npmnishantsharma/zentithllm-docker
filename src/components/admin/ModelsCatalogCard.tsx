"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ModelSummary = {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  tags?: string[];
  pipelineTag?: string;
  url: string;
};

type CatalogResponse = {
  success?: boolean;
  error?: string;
  query?: string;
  modelsFound?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  models?: ModelSummary[];
};

export function ModelsCatalogCard() {
  const router = useRouter();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading the first 200 GGUF models...');
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const currentCursorRef = useRef<string | null>(null);
  const loadedCountRef = useRef(0);

  const getDisplayName = (modelId: string) => modelId.split('/')[0] || modelId;

  const loadPage = async (cursor?: string | null, replace = false) => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsFetchingMore(!replace);
    setError(null);
    setStatus(replace ? 'Loading the first 200 GGUF models...' : 'Loading 200 more GGUF models...');

    try {
      const params = new URLSearchParams({ limit: '200' });
      if (cursor) {
        params.set('cursor', cursor);
      }

      const res = await fetch(`/api/admin/models/gguf?${params.toString()}`, {
        cache: 'no-store',
      });

      const data = (await res.json().catch(() => ({}))) as CatalogResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch GGUF models');
      }

      const pageModels = data.models || [];
      const nextLoadedCount = replace ? pageModels.length : loadedCountRef.current + pageModels.length;

      loadedCountRef.current = nextLoadedCount;
      setModels((prev) => (replace ? pageModels : [...prev, ...pageModels]));
      setLoadedCount(nextLoadedCount);
      setHasMore(Boolean(data.nextCursor));
      currentCursorRef.current = data.nextCursor || null;

      setStatus(
        data.nextCursor
          ? `Loaded ${nextLoadedCount} model${nextLoadedCount === 1 ? '' : 's'} so far. Scroll for more.`
          : `Loaded all ${nextLoadedCount} GGUF model${nextLoadedCount === 1 ? '' : 's'}.`
      );

      if (replace) {
        setLoading(false);
      }
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Request failed');
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    loadedCountRef.current = 0;
    currentCursorRef.current = null;
    setModels([]);
    setLoadedCount(0);
    setHasMore(true);
    setError(null);
    setLoading(true);
    void loadPage(null, true);
    // Reload when the user clicks refresh.
  }, [refreshToken]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isFetchingRef.current && currentCursorRef.current) {
          void loadPage(currentCursorRef.current, false);
        }
      },
      { root, rootMargin: '400px 0px', threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, models.length]);

  const refreshCatalog = () => {
    setRefreshToken((current) => current + 1);
  };

  const handleOpenModel = (model: ModelSummary) => {
    const [author, modelName] = model.id.split('/');

    if (!author || !modelName) {
      window.open(model.url, '_blank', 'noopener,noreferrer');
      return;
    }

    router.push(`/admin/models/${encodeURIComponent(author)}/${encodeURIComponent(modelName)}`);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white/90">GGUF Model Catalog</p>
          <p className="text-xs text-white/50 mt-1">
            Load 200 GGUF models at a time from Hugging Face, then fetch the next 200 when you scroll near the bottom.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshCatalog}
          disabled={loading}
          className="text-xs px-3.5 py-1.5 rounded-full border border-white/15 text-white/90 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          {loading ? 'Loading...' : 'Reload Catalog'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/55">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
          {loading ? 'Loading first page' : 'Loaded'}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
          {loadedCount} model{loadedCount === 1 ? '' : 's'}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 truncate max-w-[100%]">
          {status}
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div ref={scrollContainerRef} className="mt-4 space-y-3 max-h-[68vh] overflow-y-auto pr-1 custom-scrollbar">
        {models.length === 0 && loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
            Waiting for the first GGUF model...
          </div>
        ) : null}

        {models.map((model) => (
          <button
            key={model.id}
            type="button"
            onClick={() => handleOpenModel(model)}
            className="block w-full rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90 truncate">{getDisplayName(model.id)}</p>
                <p className="text-[11px] text-white/40 mt-0.5 truncate">{model.id}</p>
                <p className="text-[11px] text-white/55 mt-0.5">
                  by {model.author || 'unknown'} • downloads {model.downloads || 0} • likes {model.likes || 0}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-wider text-white/50">
                GGUF
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-white/60">
              {model.pipelineTag && (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                  {model.pipelineTag}
                </span>
              )}
              {model.lastModified && (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                  Updated {new Date(model.lastModified).toLocaleDateString()}
                </span>
              )}
              {model.tags?.slice(0, 4).map((tag) => (
                <span key={`${model.id}-${tag}`} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}

        <div ref={sentinelRef} className="h-1 w-full" />

        {isFetchingMore && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
            Loading 200 more models...
          </div>
        )}

        {!hasMore && models.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
            You&apos;ve reached the end of the GGUF catalog.
          </div>
        )}
      </div>
    </div>
  );
}
