'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';

import { PdfDropzone } from './PdfDropzone';
import { ProfileSummary } from './ProfileSummary';
import { RESUME_ERROR_COPY, type ResumeApiResponse } from './resume-shared';
import type { Profile } from '@/lib/types';

type State =
  | { kind: 'idle' }
  | { kind: 'processing'; fileName: string }
  | { kind: 'done'; profile: Profile; resumeId: string; fileName: string }
  | { kind: 'error'; message: string };

function ProcessingPanel({ fileName }: { fileName: string }) {
  return (
    <div className="border border-border px-6 py-10">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xl tracking-tight">Reading your resume…</p>
        <p className="text-[0.8125rem] text-muted-foreground">{fileName}</p>
      </div>
      <p className="mt-3 max-w-prose text-[0.9375rem] text-muted-foreground">
        Extracting your profile. This usually takes 10–20 seconds.
      </p>
    </div>
  );
}

export function OnboardingClient() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const upload = useCallback(async (file: File) => {
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
      setState({
        kind: 'done',
        profile: data.profile,
        resumeId: data.resumeId,
        fileName: file.name,
      });
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Network error. Try again.',
      });
    }
  }, []);

  const reset = useCallback(() => setState({ kind: 'idle' }), []);

  if (state.kind === 'processing') {
    return <ProcessingPanel fileName={state.fileName} />;
  }

  if (state.kind === 'done') {
    return (
      <div className="space-y-10">
        <div>
          <h2 className="font-display text-3xl tracking-tight">Looks right?</h2>
          <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
            Here&apos;s what we pulled from <span className="text-foreground">{state.fileName}</span>.
            If this is accurate, head to pricing to start your trial.
          </p>
        </div>

        <ProfileSummary profile={state.profile} />

        <div className="flex flex-wrap items-center gap-5 border-t border-border pt-8">
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center border border-foreground bg-foreground px-5 text-[0.875rem] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Continue to billing →
          </Link>
          <button
            type="button"
            onClick={reset}
            className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Try a different resume
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PdfDropzone onFile={upload} />
      {state.kind === 'error' && (
        <div className="flex items-center justify-between gap-3 border border-destructive/40 px-4 py-3">
          <span className="text-[0.8125rem] text-destructive" role="alert">
            {state.message}
          </span>
          <button
            type="button"
            onClick={reset}
            className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
