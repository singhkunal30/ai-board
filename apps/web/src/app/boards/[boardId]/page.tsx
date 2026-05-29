'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';
import type { Board } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { BoardCanvas } from '@/components/Canvas';
import { Spinner } from '@/components/ui';

export default function BoardPage() {
  const token = useRequireAuth();
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Board>(`/boards/${boardId}`)
      .then(setBoard)
      .catch((e) => setError(e?.message ?? 'Failed to load board'));
  }, [token, boardId]);

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <TopBar title={board?.title ?? 'Board'} />
      <div className="relative flex-1">
        {error ? (
          <div className="flex h-full items-center justify-center text-red-500">{error}</div>
        ) : !board ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-6 w-6 text-indigo-600" />
          </div>
        ) : (
          <BoardCanvas boardId={boardId} />
        )}
      </div>
    </div>
  );
}
