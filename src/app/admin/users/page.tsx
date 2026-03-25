import { redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/session';
import { UserService } from '@/lib/database';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

function formatDate(value?: Date): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

export default async function AdminUsersPage() {
  async function toggleAdminRole(formData: FormData) {
    'use server';

    const actingUser = await getSessionUser();
    if (!actingUser || !actingUser.isAdmin) {
      return;
    }

    const targetUserId = formData.get('targetUserId')?.toString();
    const nextIsAdmin = formData.get('nextIsAdmin')?.toString() === 'true';

    if (!targetUserId) {
      return;
    }

    if (actingUser.userId === targetUserId && !nextIsAdmin) {
      return;
    }

    await UserService.updateUser(targetUserId, { isAdmin: nextIsAdmin });
    revalidatePath('/admin/users');
  }

  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/login');
  }

  if (!sessionUser.isAdmin) {
    redirect('/chat');
  }

  const users = await UserService.listUsersDetailed(200);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      <AdminSidebar sessionUser={sessionUser} active="users" />

      <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden border border-white/10 m-[10px] rounded-2xl">
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
          <div>
            <h1 className="text-sm font-semibold text-white/90">Users</h1>
            <p className="text-[11px] text-white/40">Total ({users.length})</p>
          </div>
          <Link
            href="/chat"
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
          >
            Back to Chat
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/50">Total Users</p>
                <p className="text-2xl font-semibold text-white mt-1">{users.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/50">Admins</p>
                <p className="text-2xl font-semibold text-white mt-1">{users.filter((u) => u.isAdmin).length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/50">MFA Enabled</p>
                <p className="text-2xl font-semibold text-white mt-1">{users.filter((u) => u.mfaEnabled).length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/50">Passkeys Registered</p>
                <p className="text-2xl font-semibold text-white mt-1">{users.reduce((acc, u) => acc + (u.passkeys?.length || 0), 0)}</p>
              </div>
            </div>

            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="rounded-3xl border border-white/10 bg-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.25)] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-full border border-white/10 bg-white/10 flex items-center justify-center text-sm text-white font-semibold shrink-0">
                        {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-white truncate">{user.displayName || 'User'}</p>
                        <p className="text-sm text-white/70 truncate">{user.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${user.isAdmin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/70'}`}>
                            {user.isAdmin ? 'Admin' : 'User'}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${user.mfaEnabled ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-white/60'}`}>
                            MFA {user.mfaEnabled ? 'On' : 'Off'}
                          </span>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-white/10 text-white/70">
                            Passkeys {user.passkeys?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <form action={toggleAdminRole}>
                      <input type="hidden" name="targetUserId" value={user.id} />
                      <input type="hidden" name="nextIsAdmin" value={String(!user.isAdmin)} />
                      <button
                        type="submit"
                        disabled={sessionUser.userId === user.id && user.isAdmin}
                        className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/85 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                      <p className="text-white/50">Conversations</p>
                      <p className="text-white/85 font-medium mt-0.5">{user.conversationCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                      <p className="text-white/50">Messages</p>
                      <p className="text-white/85 font-medium mt-0.5">{user.messageCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                      <p className="text-white/50">Joined</p>
                      <p className="text-white/85 font-medium mt-0.5">{formatDate(user.createdAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-2.5">
                      <p className="text-white/50">Last Login</p>
                      <p className="text-white/85 font-medium mt-0.5">{formatDate(user.lastLogin)}</p>
                    </div>
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
                  No users found.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
