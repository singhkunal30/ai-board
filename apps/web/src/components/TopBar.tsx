'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useTheme } from './ThemeProvider';
import { Button } from './ui';

export function TopBar({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  const router = useRouter();
  const { user, refreshToken, clear } = useAuthStore();
  const { theme, toggle } = useTheme();

  async function logout() {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
    clear();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <Link href="/workspaces" className="font-semibold text-indigo-600">
          AI-Board
        </Link>
        {title && <span className="text-slate-400">/</span>}
        {title && <span className="font-medium">{title}</span>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button variant="ghost" onClick={toggle} aria-label="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </Button>
        {user && <span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span>}
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
