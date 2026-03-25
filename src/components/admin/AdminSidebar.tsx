import Link from 'next/link';
import { MessageSquare, Settings, Shield, Sparkles, Users } from 'lucide-react';
import type { SessionUser } from '@/lib/session';

type AdminSidebarProps = {
  sessionUser: SessionUser;
  active: 'users' | 'settings';
};

export function AdminSidebar({ sessionUser, active }: AdminSidebarProps) {
  return (
    <aside className="bg-[#0d0d0d] border border-white/10 flex flex-col shrink-0 z-50 w-72 mt-[10px] mb-[10px] ml-[10px] rounded-3xl overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-[11px] text-white/80">
          <Shield size={12} />
          Admin Workspace
        </div>
        <div className="mt-3">
          <p className="text-base font-semibold text-white/95">Nexus Admin</p>
          <p className="text-xs text-white/50">Manage users and access</p>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2">
        <p className="px-2 text-[11px] uppercase tracking-wider text-white/35 mb-2">Navigation</p>

        <Link
          href="/admin/users"
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm border transition-colors ${
            active === 'users'
              ? 'bg-white/10 text-white border-white/10'
              : 'text-white/65 border-transparent hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5">
            <Users size={15} />
            Users
          </span>
          {active === 'users' && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
        </Link>

        <Link
          href="/admin/settings"
          className={`mt-2 w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm border transition-colors ${
            active === 'settings'
              ? 'bg-white/10 text-white border-white/10'
              : 'text-white/65 border-transparent hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="inline-flex items-center gap-2.5">
            <Settings size={15} />
            Settings
          </span>
          {active === 'settings' && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
        </Link>

        <Link
          href="/chat"
          className="mt-2 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm text-white/65 hover:bg-white/5 hover:text-white transition-colors"
        >
          <MessageSquare size={15} />
          Chat
        </Link>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-white/55">
            <Sparkles size={12} />
            Quick hint
          </p>
          <p className="mt-1 text-xs text-white/65 leading-5">
            Use Settings to switch private mode and control allowlisted emails.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-white/5 mt-auto bg-white/[0.02]">
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 border border-white/10">
          <div className="h-9 w-9 rounded-full border border-white/10 bg-white/10 flex items-center justify-center text-xs text-white/80">
            {(sessionUser.displayName || sessionUser.email || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-white/90">{sessionUser.displayName || 'User'}</p>
            <p className="text-[11px] text-white/50 truncate">{sessionUser.email || '-'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
