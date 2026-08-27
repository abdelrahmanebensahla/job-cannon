'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ResumeReviewView } from './ResumeReviewView';
import { RESUME_ERROR_COPY } from './resume-shared';
import { formatLongDate } from '@/lib/date';
import type { ResumeReview } from '@/lib/types';

type ApiResponse =
  | { ok: true; review: ResumeReview; filename: string }
  | { ok: false; error: string };

type State =
  | { kind: 'idle' }
  | { kind: 'processing' }
  | { kind: 'done'; review: ResumeReview }
  | { kind: 'error'; message: string };

type Props = {
  initialReview: ResumeReview | null;
  initialDate: string | null;
  resumeFilename: string;
  hasPdf: boolean;
};

export function ReviewClient({ initialReview, initialDate, resumeFilename, hasPdf }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const run = useCallback(async () => {
    setState({ kind: 'processing' });
    try {
      const res = await fetch('/api/review', { method: 'POST' });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) {
        const code = !data.ok ? data.error : 'unknown';
        setState({
          kind: 'error',
          message: RESUME_ERROR_COPY[code] ?? `Something went wrong (${code}). Please try again.`,
        });
        return;
      }
      setState({ kind: 'done', review: data.review });
      // Server page re-reads the persisted latest review on refresh.
      router.refresh();
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Network error. Try again.',
      });
    }
  }, [router]);

  // Resume predates PDF storage (file_data is null) — there's nothing to read,
  // so prompt a re-upload instead of a button that would just error.
  if (!hasPdf) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] text-foreground">{resumeFilename}</p>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Review unavailable</p>
          </div>
          <Link
            href="/dashboard/resume"
            className="inline-flex h-10 items-center border border-foreground bg-foreground px-5 text-[0.875rem] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Re-upload to enable review →
          </Link>
        </div>
        <p className="max-w-prose text-[0.9375rem] text-muted-foreground">
          This resume was uploaded before full-PDF review existed, so there&apos;s no document to
          read. Re-upload it on the Resume page to enable a detailed review.
        </p>
        {initialReview && <ResumeReviewView review={initialReview} />}
      </div>
    );
  }

  const processing = state.kind === 'processing';
  const shownReview = state.kind === 'done' ? state.review : initialReview;
  const hasReview = Boolean(shownReview);

  const statusLine =
    state.kind === 'done'
      ? 'Reviewed just now'
      : initialReview && initialDate
        ? `Last reviewed ${formatLongDate(initialDate)}`
        : 'Your active resume';

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] text-foreground">{resumeFilename}</p>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{statusLine}</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={processing}
          className="inline-flex h-10 items-center border border-foreground bg-foreground px-5 text-[0.875rem] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? 'Reviewing…' : hasReview ? 'Re-review my resume' : 'Review my resume'}
        </button>
      </div>

      {processing && (
        <div className="border border-border px-6 py-10">
          <p className="font-display text-xl tracking-tight">Reviewing your resume…</p>
          <p className="mt-3 max-w-prose text-[0.9375rem] text-muted-foreground">
            Reading your full resume PDF and assessing structure, wording, impact, and gaps. Usually
            15–30 seconds.
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="flex items-center justify-between gap-3 border border-destructive/40 px-4 py-3">
          <span className="text-[0.8125rem] text-destructive" role="alert">
            {state.message}
          </span>
          <button
            type="button"
            onClick={() => setState({ kind: 'idle' })}
            className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {!processing && shownReview && <ResumeReviewView review={shownReview} />}
    </div>
  );
}
