"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type LocalModelEntry = {
  name: string;
  sizeBytes: number;
  sizeReadable: string;
  modifiedAt: string;
};

type LocalModelResponse = {
  success?: boolean;
  error?: string;
  model?: LocalModelEntry;
  renamed?: {
    from: string;
    to: string;
  };
};

type LocalModelEditorProps = {
  model: LocalModelEntry;
};

export function LocalModelEditor({ model }: LocalModelEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(model.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseName = useMemo(
    () => (name.toLowerCase().endsWith('.gguf') ? name.slice(0, -5) : name),
    [name]
  );

  const onRename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = (new FormData(event.currentTarget).get('name') || '').toString().trim();
    if (!input) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/models/local', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentName: model.name,
          newName: input,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as LocalModelResponse;
      if (!response.ok || !data.success || !data.renamed?.to) {
        throw new Error(data.error || 'Rename failed');
      }

      router.push(`/admin/models/local/${encodeURIComponent(data.renamed.to)}`);
      router.refresh();
    } catch (renameError: any) {
      setError(renameError?.message || 'Rename failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/models/local', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: model.name }),
      });

      const data = (await response.json().catch(() => ({}))) as LocalModelResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Delete failed');
      }

      router.push('/admin/models');
      router.refresh();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
      <p className="text-sm font-semibold text-white/90">Edit Local Model</p>
      <p className="text-xs text-white/50 mt-1">Rename this GGUF file or delete it from local storage.</p>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-white/50">File</p>
          <p className="text-white/90 mt-0.5 truncate">{model.name}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-white/50">Size</p>
          <p className="text-white/90 mt-0.5">{model.sizeReadable}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 sm:col-span-1 col-span-2">
          <p className="text-white/50">Updated</p>
          <p className="text-white/90 mt-0.5">{new Date(model.modifiedAt).toLocaleString()}</p>
        </div>
      </div>

      <form className="mt-4" onSubmit={onRename}>
        <label className="block text-xs text-white/60">
          Rename model
          <div className="mt-1 flex items-center gap-2">
            <input
              name="name"
              defaultValue={baseName}
              className="h-10 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-white/25"
              placeholder="new-model-name"
            />
            <span className="text-xs text-white/55">.gguf</span>
          </div>
        </label>
        <button
          type="submit"
          disabled={saving || deleting}
          className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="text-xs text-red-300/85 mb-2">Danger zone</p>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting || saving}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 hover:bg-red-500/15 transition-colors disabled:opacity-40"
        >
          {deleting ? 'Deleting...' : 'Delete Model'}
        </button>
      </div>
    </div>
  );
}
