"use client";

import { useEffect, useMemo, useState } from 'react';

type ModelAccessSettings = {
  accessMode: 'open' | 'allowlist';
  allowedEmails: string[];
  blockedEmails: string[];
  defaultRateLimit: number;
  defaultRateWindowMinutes: number;
  adminsBypassAccess: boolean;
  adminsBypassRateLimit: boolean;
  allowManualUpload: boolean;
  allowDirectHuggingFaceUrl: boolean;
  maxUploadSizeMb: number;
  updatedAt: string;
};

type ModelPolicy = {
  userId: string;
  canAccessModels?: boolean | null;
  rateLimit?: number | null;
  rateWindowMinutes?: number | null;
  notes?: string | null;
  updatedAt?: string;
};

type ModelPolicyUser = {
  id: string;
  email: string;
  displayName?: string;
  isAdmin: boolean;
  modelPolicy: ModelPolicy | null;
};

type PolicyResponse = {
  success?: boolean;
  error?: string;
  settings?: ModelAccessSettings;
  users?: ModelPolicyUser[];
};

function emailsToText(emails: string[]): string {
  return emails.join('\n');
}

function parseEmails(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function ModelAccessManager() {
  const [settings, setSettings] = useState<ModelAccessSettings | null>(null);
  const [users, setUsers] = useState<ModelPolicyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadPolicies = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/models/policies', { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as PolicyResponse;

      if (!response.ok || !data.success || !data.settings || !data.users) {
        throw new Error(data.error || 'Failed to load model policies');
      }

      setSettings(data.settings);
      setUsers(data.users);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load model policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPolicies();
  }, []);

  const editableUsers = useMemo(() => users.filter((user) => !user.isAdmin), [users]);

  const handleGlobalSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving('global');
    setError(null);
    setStatus(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/admin/models/policies', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessMode: formData.get('accessMode'),
          allowedEmails: parseEmails(String(formData.get('allowedEmails') || '')),
          blockedEmails: parseEmails(String(formData.get('blockedEmails') || '')),
          defaultRateLimit: Number(formData.get('defaultRateLimit') || 0),
          defaultRateWindowMinutes: Number(formData.get('defaultRateWindowMinutes') || 60),
          adminsBypassAccess: formData.get('adminsBypassAccess') === 'on',
          adminsBypassRateLimit: formData.get('adminsBypassRateLimit') === 'on',
          allowManualUpload: formData.get('allowManualUpload') === 'on',
          allowDirectHuggingFaceUrl: formData.get('allowDirectHuggingFaceUrl') === 'on',
          maxUploadSizeMb: Number(formData.get('maxUploadSizeMb') || 0),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as PolicyResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save model policy settings');
      }

      setStatus('Global model policy saved.');
      await loadPolicies();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save model policy settings');
    } finally {
      setSaving(null);
    }
  };

  const handleUserSave = async (event: React.FormEvent<HTMLFormElement>, userId: string, hasOverride: boolean) => {
    event.preventDefault();
    setSaving(userId);
    setError(null);
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const accessMode = String(formData.get('accessMode') || 'inherit');
    const rateLimitValue = String(formData.get('rateLimit') || '').trim();
    const windowValue = String(formData.get('rateWindowMinutes') || '').trim();
    const notesValue = String(formData.get('notes') || '').trim();
    const hasExplicitValues = accessMode !== 'inherit' || rateLimitValue !== '' || windowValue !== '' || notesValue !== '';

    try {
      if (!hasExplicitValues) {
        if (hasOverride) {
          const response = await fetch('/api/admin/models/policies', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });

          const data = (await response.json().catch(() => ({}))) as PolicyResponse;

          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to remove user policy override');
          }
          setStatus('User override removed.');
          await loadPolicies();
        }

        return;
      }

      const response = await fetch('/api/admin/models/policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          canAccessModels: accessMode === 'inherit' ? null : accessMode === 'allow',
          rateLimit: rateLimitValue === '' ? null : Number(rateLimitValue),
          rateWindowMinutes: windowValue === '' ? null : Number(windowValue),
          notes: notesValue === '' ? null : notesValue,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as PolicyResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save user policy override');
      }

      setStatus('User policy updated.');
      await loadPolicies();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save user policy override');
    } finally {
      setSaving(null);
    }
  };

  const globalKey = settings?.updatedAt || 'global';

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/90">Model Access and Rate Limits</p>
            <p className="text-xs text-white/50 mt-1">
              Set the default access mode, allow or block specific emails, and define the baseline rate limit for model actions.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPolicies}
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

        {status && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {status}
          </div>
        )}

        {loading && !settings ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
            Loading model policies...
          </div>
        ) : null}

        {settings ? (
          <form key={globalKey} onSubmit={handleGlobalSave} className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <label className="block text-xs text-white/60">
                Access mode
                <select
                  name="accessMode"
                  defaultValue={settings.accessMode}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                >
                  <option value="open">Open</option>
                  <option value="allowlist">Allowlist</option>
                </select>
              </label>

              <label className="block text-xs text-white/60">
                Allowed emails
                <textarea
                  name="allowedEmails"
                  defaultValue={emailsToText(settings.allowedEmails)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-y"
                  placeholder="one@email.com\nanother@email.com"
                />
              </label>

              <label className="block text-xs text-white/60">
                Blocked emails
                <textarea
                  name="blockedEmails"
                  defaultValue={emailsToText(settings.blockedEmails)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25 resize-y"
                  placeholder="blocked@email.com"
                />
              </label>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Default limits</p>

              <label className="block text-xs text-white/60">
                Requests per window
                <input
                  name="defaultRateLimit"
                  type="number"
                  min={0}
                  defaultValue={settings.defaultRateLimit}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                />
              </label>

              <label className="block text-xs text-white/60">
                Window length in minutes
                <input
                  name="defaultRateWindowMinutes"
                  type="number"
                  min={1}
                  defaultValue={settings.defaultRateWindowMinutes}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                />
              </label>

              <label className="block text-xs text-white/60">
                Max upload size (MB, 0 = unlimited)
                <input
                  name="maxUploadSizeMb"
                  type="number"
                  min={0}
                  defaultValue={settings.maxUploadSizeMb}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70 gap-3">
                <span>Admins bypass access checks</span>
                <input
                  name="adminsBypassAccess"
                  type="checkbox"
                  defaultChecked={settings.adminsBypassAccess}
                  className="h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70 gap-3">
                <span>Admins bypass rate limits</span>
                <input
                  name="adminsBypassRateLimit"
                  type="checkbox"
                  defaultChecked={settings.adminsBypassRateLimit}
                  className="h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70 gap-3">
                <span>Allow manual GGUF uploads</span>
                <input
                  name="allowManualUpload"
                  type="checkbox"
                  defaultChecked={settings.allowManualUpload}
                  className="h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70 gap-3">
                <span>Allow direct Hugging Face resolve URL</span>
                <input
                  name="allowDirectHuggingFaceUrl"
                  type="checkbox"
                  defaultChecked={settings.allowDirectHuggingFaceUrl}
                  className="h-4 w-4"
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/50">
                Updated {new Date(settings.updatedAt).toLocaleString()}
              </div>

              <button
                type="submit"
                disabled={saving === 'global'}
                className="w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/15 transition-colors disabled:opacity-40"
              >
                {saving === 'global' ? 'Saving...' : 'Save Global Policy'}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/90">Per-user Overrides</p>
            <p className="text-xs text-white/50 mt-1">
              Override access or rate limits for specific users. Leave everything on inherit to remove the override.
            </p>
          </div>
          <div className="text-xs text-white/45">{editableUsers.length} users</div>
        </div>

        <div className="mt-4 space-y-3 max-h-[58vh] overflow-y-auto pr-1 custom-scrollbar">
          {loading && users.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
              Loading users...
            </div>
          ) : null}

          {!loading && users.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/45">
              No users found.
            </div>
          ) : null}

          {users.map((user) => {
            const policy = user.modelPolicy;
            const accessMode = policy?.canAccessModels === true ? 'allow' : policy?.canAccessModels === false ? 'deny' : 'inherit';

            return (
              <form
                key={`${user.id}:${policy?.updatedAt || 'none'}`}
                onSubmit={(event) => handleUserSave(event, user.id, Boolean(policy))}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      <span className="truncate max-w-[20rem]">{user.displayName || user.email}</span>
                      {user.isAdmin ? (
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                          Admin
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-white/55 mt-0.5 break-all">{user.email}</p>
                  </div>
                  <div className="text-[11px] text-white/45 text-right">
                    {policy ? `Policy updated ${new Date(policy.updatedAt || '').toLocaleString()}` : 'Inherit global policy'}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <label className="block text-xs text-white/60 md:col-span-1">
                    Access
                    <select
                      name="accessMode"
                      defaultValue={accessMode}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    >
                      <option value="inherit">Inherit</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </label>

                  <label className="block text-xs text-white/60">
                    Requests
                    <input
                      name="rateLimit"
                      type="number"
                      min={0}
                      defaultValue={policy?.rateLimit ?? ''}
                      placeholder="inherit"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    />
                  </label>

                  <label className="block text-xs text-white/60">
                    Window minutes
                    <input
                      name="rateWindowMinutes"
                      type="number"
                      min={1}
                      defaultValue={policy?.rateWindowMinutes ?? ''}
                      placeholder="inherit"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    />
                  </label>

                  <label className="block text-xs text-white/60 md:col-span-1">
                    Notes
                    <input
                      name="notes"
                      type="text"
                      defaultValue={policy?.notes ?? ''}
                      placeholder="optional note"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving === user.id}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors disabled:opacity-40"
                  >
                    {saving === user.id ? 'Saving...' : 'Save Override'}
                  </button>
                  {policy ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setSaving(user.id);
                        setError(null);
                        setStatus(null);

                        try {
                          const response = await fetch('/api/admin/models/policies', {
                            method: 'DELETE',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ userId: user.id }),
                          });

                          const data = (await response.json().catch(() => ({}))) as PolicyResponse;

                          if (!response.ok || !data.success) {
                            throw new Error(data.error || 'Failed to remove user policy override');
                          }

                          setStatus(`Removed override for ${user.email}.`);
                          await loadPolicies();
                        } catch (removeError: any) {
                          setError(removeError?.message || 'Failed to remove user policy override');
                        } finally {
                          setSaving(null);
                        }
                      }}
                      disabled={saving === user.id}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 hover:bg-red-500/15 transition-colors disabled:opacity-40"
                    >
                      Remove Override
                    </button>
                  ) : null}
                </div>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}