'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { Spinner } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    router.replace(accessToken ? '/workspaces' : '/login');
  }, [accessToken, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner className="h-6 w-6 text-indigo-600" />
    </div>
  );
}
