'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center border border-border bg-background px-4 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
      >
        Replace resume
      </button>
    );
  }

  if (state.kind === 'processing') {
    return (
      <div className="border border-border px-5 py-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[0.9375rem] font-medium">Reading your new resume…</p>
          <p className="text-[0.8125rem] text-muted-foreground">{state.fileName}</p>
        </div>
        <p className="mt-3 text-[0.8125rem] text-muted-foreground">
          Extracting your profile. This usually takes 10–20 seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PdfDropzone onFile={upload} idleLabel="Drop your new resume PDF here" />
      {state.kind === 'error' && (
        <p className="text-[0.8125rem] text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
