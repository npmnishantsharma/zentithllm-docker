import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminModelsTabs } from '@/components/admin/AdminModelsTabs';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminModelsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/login');
  }

  if (!sessionUser.isAdmin) {
    redirect('/chat');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      <AdminSidebar sessionUser={sessionUser} active="models" />

      <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden border border-white/10 m-[10px] rounded-2xl">
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
          <div>
            <h1 className="text-sm font-semibold text-white/90">Models</h1>
            <p className="text-[11px] text-white/40">Download, discover GGUF models, and pick the best fit</p>
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
            <AdminModelsTabs />
          </div>
        </div>
      </main>
    </div>
  );
}
