'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PdfDropzone } from './PdfDropzone';
import { ResumeReviewView } from './ResumeReviewView';
import { RESUME_ERROR_COPY } from './resume-shared';
import { formatLongDate } from '@/lib/date';
import type { ResumeReview } from '@/lib/types';

type ApiResponse =
  | { ok: true; review: ResumeReview; filename: string }
  | { ok: false; error: string };

type State =
  | { kind: 'idle' }
  | { kind: 'processing'; fileName: string }
  | { kind: 'done'; review: ResumeReview; fileName: string }
  | { kind: 'error'; message: string };

type Props = {
  initialReview: ResumeReview | null;
  initialFilename: string | null;
  initialDate: string | null;
};

function ProcessingPanel({ fileName }: { fileName: string }) {
  return (
    <div className="border border-border px-6 py-10">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xl tracking-tight">Reviewing your resume…</p>
        <p className="text-[0.8125rem] text-muted-foreground">{fileName}</p>
      </div>
      <p className="mt-3 max-w-prose text-[0.9375rem] text-muted-foreground">
        Reading the document and assessing structure, wording, impact, and gaps. Usually 15–30 seconds.
      </p>
    </div>
  );
}

export function ReviewClient({ initialReview, initialFilename, initialDate }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });
  // No saved review yet → show the uploader immediately.
  const [showUpload, setShowUpload] = useState(!initialReview);

  const upload = useCallback(
    async (file: File) => {
      setState({ kind: 'processing', fileName: file.name });
      try {
        const form = new FormData();
        form.append('resume', file);
        const res = await fetch('/api/review', { method: 'POST', body: form });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok || !data.ok) {
          const code = !data.ok ? data.error : 'unknown';
          setState({
            kind: 'error',
            message: RESUME_ERROR_COPY[code] ?? `Something went wrong (${code}). Please try again.`,
          });
          return;
        }
        setState({ kind: 'done', review: data.review, fileName: data.filename });
        setShowUpload(false);
        // Server page re-reads the persisted latest review on refresh.
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

  if (state.kind === 'processing') {
    return <ProcessingPanel fileName={state.fileName} />;
  }

  // A fresh result takes precedence over the saved one.
  const shownReview = state.kind === 'done' ? state.review : initialReview;
  const shownFilename = state.kind === 'done' ? state.fileName : initialFilename;
  const shownDateLabel =
    state.kind === 'done' ? 'just now' : initialDate ? formatLongDate(initialDate) : null;

  return (
    <div className="space-y-10">
      {showUpload ? (
        <div className="space-y-4">
          <PdfDropzone onFile={upload} idleLabel="Drop your resume PDF to review" />
          {state.kind === 'error' && (
            <div className="flex items-center justify-between gap-3 border border-[--color-destructive]/40 px-4 py-3">
              <span className="text-[0.8125rem] text-[--color-destructive]" role="alert">
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
          {initialReview && (
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[0.8125rem] text-muted-foreground">
            {shownFilename ? (
              <>
                Reviewed <span className="text-foreground">{shownFilename}</span>
              </>
            ) : (
              'Latest review'
            )}
            {shownDateLabel ? ` · ${shownDateLabel}` : ''}
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex h-9 items-center border border-border bg-background px-4 text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
          >
            Review a new version
          </button>
        </div>
      )}

      {shownReview && <ResumeReviewView review={shownReview} />}
    </div>
  );
}
