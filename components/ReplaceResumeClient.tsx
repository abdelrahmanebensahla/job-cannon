'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { PdfDropzone } from './PdfDropzone';
import { RESUME_ERROR_COPY, type ResumeApiResponse } from './resume-shared';

type State =
  | { kind: 'idle' }
  | { kind: 'processing'; fileName: string }
  | { kind: 'error'; message: string };

export function ReplaceResumeClient() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [open, setOpen] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setState({ kind: 'processing', fileName: file.name });
      try {
        const form = new FormData();
        form.append('resume', file);
        const res = await fetch('/api/resume', { method: 'POST', body: form });
        const data = (await res.json()) as ResumeApiResponse;
        if (!res.ok || !data.ok) {
          const code = !data.ok ? data.error : 'unknown';
          setState({
            kind: 'error',
            message: RESUME_ERROR_COPY[code] ?? `Something went wrong (${code}). Please try again.`,
          });
          return;
        }
        // Server-rendered resume view will show the new active row on refresh.
        setState({ kind: 'idle' });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setState({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Network error. Try again.',
        });
      }
    },
    [router],
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Replace resume
      </Button>
    );
  }

  if (state.kind === 'processing') {
    return (
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">Reading your new resume…</p>
              <p className="text-xs text-muted-foreground">{state.fileName}</p>
            </div>
            <Progress value={null} />
          </div>
          <div className="space-y-3 border-t pt-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <PdfDropzone onFile={upload} idleLabel="Drop your new resume PDF here" />
      {state.kind === 'error' && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="text-rose-500">{state.message}</span>
            <Button variant="outline" size="sm" onClick={() => setState({ kind: 'idle' })}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
