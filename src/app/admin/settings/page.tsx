import { redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/session';
import { AppSettingsService } from '@/lib/database';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  async function updateAppSettings(formData: FormData) {
    'use server';

    const actingUser = await getSessionUser();
    if (!actingUser || !actingUser.isAdmin) {
      return;
    }

    const isPrivate = formData.get('isPrivate') === 'on';
    const rawAllowed = (formData.get('allowedEmails')?.toString() || '').trim();
    const allowedEmails = rawAllowed
      .split(/\r?\n|,|;/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    await AppSettingsService.updateSettings(
      { isPrivate, allowedEmails },
      actingUser.userId
    );

    revalidatePath('/admin/settings');
  }

  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/login');
  }

  if (!sessionUser.isAdmin) {
    redirect('/chat');
  }

  const appSettings = await AppSettingsService.getSettings();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      <AdminSidebar sessionUser={sessionUser} active="settings" />

      <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden border border-white/10 m-[10px] rounded-2xl">
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
          <div>
            <h1 className="text-sm font-semibold text-white/90">Settings</h1>
            <p className="text-[11px] text-white/40">Configure privacy and access</p>
          </div>
          <Link
            href="/chat"
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
          >
            Back to Chat
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="rounded-3xl border border-white/10 bg-[#111111] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white/90">App Privacy</p>
                  <p className="text-xs text-white/50 mt-1">
                    When private mode is enabled, only allowlisted emails can sign in.
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-full ${appSettings.isPrivate ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {appSettings.isPrivate ? 'Private' : 'Public'}
                </span>
              </div>

              <form action={updateAppSettings} className="mt-4 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm text-white/85">
                  <input
                    type="checkbox"
                    name="isPrivate"
                    defaultChecked={appSettings.isPrivate}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  Enable private mode
                </label>

                <div>
                  <label className="block text-xs text-white/55 mb-1.5">Allowed emails (one per line)</label>
                  <textarea
                    name="allowedEmails"
                    defaultValue={appSettings.allowedEmails.join('\n')}
                    placeholder="user1@example.com&#10;user2@example.com"
                    className="w-full min-h-[180px] rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="text-xs px-3.5 py-1.5 rounded-full border border-white/15 text-white/90 hover:bg-white/5 transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
