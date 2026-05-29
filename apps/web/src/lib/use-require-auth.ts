'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from './auth-store';

/** Redirects to /login when there is no session. Use at the top of pages. */
export function useRequireAuth() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);
  return accessToken;
}
