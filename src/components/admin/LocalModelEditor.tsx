"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type LocalModelEntry = {
  name: string;
  sizeBytes: number;
  sizeReadable: string;
  modifiedAt: string;
  settings?: any;
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
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<boolean>(false);

  const [settings, setSettings] = useState({
    maxTokens: model.settings?.maxTokens ?? 512,
    temperature: model.settings?.temperature ?? 0.7,
    topP: model.settings?.topP ?? 0.9,
    contextSize: model.settings?.contextSize ?? 4096,
    batchSize: model.settings?.batchSize ?? 512,
  });

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

  const onSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(false);

    try {
      const response = await fetch('/api/admin/models/local', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: model.name,
          settings,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
      router.refresh();
    } catch (e: any) {
      setSettingsError(e.message);
    } finally {
      setSavingSettings(false);
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

      <form className="mt-6 border-t border-white/10 pt-4" onSubmit={onSaveSettings}>
        <p className="text-sm font-semibold text-white/90 mb-1">Model Settings</p>
        <p className="text-xs text-white/50 mb-4">Set default inference parameters for this model.</p>

        {settingsError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {settingsError}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <label className="block text-white/60">
            Context Size
            <input
              type="number"
              value={settings.contextSize}
              onChange={(e) => setSettings({ ...settings, contextSize: parseInt(e.target.value) || 0 })}
              className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-white/25"
            />
          </label>
          <label className="block text-white/60">
            Max Tokens
            <input
              type="number"
              value={settings.maxTokens}
              onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 0 })}
              className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-white/25"
            />
          </label>
          <label className="block text-white/60">
            Batch Size
            <input
              type="number"
              value={settings.batchSize}
              onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) || 0 })}
              className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-white/25"
            />
          </label>
          <label className="block text-white/60">
            Temperature
            <input
              type="number"
              step="0.1"
              max="2.0"
              min="0"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) || 0 })}
              className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-white/25"
            />
          </label>
          <label className="block text-white/60">
            Top P
            <input
              type="number"
              step="0.05"
              max="1.0"
              min="0"
              value={settings.topP}
              onChange={(e) => setSettings({ ...settings, topP: parseFloat(e.target.value) || 0 })}
              className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-white/25"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={savingSettings || deleting}
            className="rounded-xl border border-[#19c37d]/30 bg-[#19c37d]/10 px-4 py-2 text-sm text-[#19c37d] hover:bg-[#19c37d]/20 transition-colors disabled:opacity-40"
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
          {settingsSuccess && <span className="text-xs text-[#19c37d]">Saved successfully!</span>}
        </div>
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
