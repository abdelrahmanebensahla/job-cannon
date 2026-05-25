'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { JobCard } from './JobCard';
import { ProfileSummary } from './ProfileSummary';
import type { MatchedJob, Profile } from '@/lib/types';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type State =
  | { kind: 'idle' }
  | { kind: 'processing'; fileName: string }
  | { kind: 'done'; profile: Profile; results: MatchedJob[]; fileName: string }
  | { kind: 'error'; message: string };

type ApiResponse =
  | { ok: true; profile: Profile; results: MatchedJob[] }
  | { ok: false; error: string };

const ERROR_COPY: Record<string, string> = {
  missing_resume_field: 'No resume file received. Try again.',
  empty_resume: 'That file looked empty. Try a different PDF.',
  resume_too_large: 'PDF is over 10 MB. Trim it down and retry.',
  unsupported_media_type: 'Only PDF files are supported.',
  not_a_pdf: "That doesn't look like a real PDF.",
  invalid_form_data: 'Could not read the upload. Try again.',
  extraction_failed: "Claude couldn't read enough structure from that resume. Try a cleaner PDF.",
  ranking_failed: 'Ranking failed mid-flight. Please retry.',
};

const STEP_LABELS = ['Reading resume', 'Finding jobs', 'Ranking matches'];

function ProcessingPanel({ fileName }: { fileName: string }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [pct, setPct] = useState(8);

  useEffect(() => {
    // Lightweight time-based progression. The API call is one round-trip so we
    // can't get real per-step events; this is a visual loop, not a true gauge.
    const stepTimer = window.setInterval(() => {
      setStepIdx(i => (i < STEP_LABELS.length - 1 ? i + 1 : i));
    }, 8000);
    const progressTimer = window.setInterval(() => {
      setPct(p => (p < 92 ? p + Math.max(1, (95 - p) * 0.04) : p));
    }, 400);
    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progressTimer);
    };
  }, []);

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">{STEP_LABELS[stepIdx]}…</p>
            <p className="text-xs text-muted-foreground">{fileName}</p>
          </div>
          <Progress value={pct} />
          <ol className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            {STEP_LABELS.map((label, i) => (
              <li
                key={label}
                className={
                  i < stepIdx
                    ? 'text-foreground/70'
                    : i === stepIdx
                      ? 'font-medium text-foreground'
                      : ''
                }
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-3 border-t pt-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dropzone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const [localError, setLocalError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setLocalError(null);
      if (rejected.length > 0) {
        const code = rejected[0].errors[0]?.code;
        setLocalError(
          code === 'file-too-large'
            ? 'That PDF is over 10 MB. Trim it down.'
            : code === 'file-invalid-type'
              ? 'Only PDF files are supported.'
              : 'Could not accept that file.',
        );
        return;
      }
      const f = accepted[0];
      if (!f) return;
      onFile(f);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_PDF_BYTES,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragActive
            ? 'border-foreground/70 bg-muted/60'
            : 'border-muted-foreground/30 hover:border-muted-foreground/60'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <input {...getInputProps()} />
        <p className="text-base font-medium">
          {isDragActive ? 'Drop your resume…' : 'Drag a resume PDF here'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to choose a file · max 10 MB
        </p>
      </div>
      {localError && (
        <p className="mt-2 text-sm text-rose-500" role="alert">
          {localError}
        </p>
      )}
    </div>
  );
}

export function MatchClient() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const upload = useCallback(async (file: File) => {
    setState({ kind: 'processing', fileName: file.name });
    try {
      const form = new FormData();
      form.append('resume', file);
      const res = await fetch('/api/match', { method: 'POST', body: form });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) {
        const code = !data.ok ? data.error : 'unknown';
        setState({
          kind: 'error',
          message: ERROR_COPY[code] ?? `Something went wrong (${code}). Please try again.`,
        });
        return;
      }
      setState({
        kind: 'done',
        profile: data.profile,
        results: data.results,
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">From {state.fileName}</p>
            <h2 className="text-xl font-semibold tracking-tight">
              {state.results.length} matches
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            Try another resume
          </Button>
        </div>
        <ProfileSummary profile={state.profile} />
        {state.results.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No strong matches in the current job set. Try a resume with a different focus or check back after the next scrape.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {state.results.map(j => (
              <li key={j.id}>
                <JobCard job={j} />
              </li>
            ))}
          </ul>
        )}
        {state.results.length > 0 && (
          <Card className="border-foreground/20 bg-foreground/[0.04]">
            <CardContent className="space-y-4 p-6 text-center sm:flex sm:items-center sm:justify-between sm:gap-6 sm:space-y-0 sm:text-left">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  Get this delivered every morning at 8am.
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  $9/month or $79/year · 7-day free trial · Cancel anytime in the Stripe portal.
                </p>
              </div>
              <Link
                href="/pricing"
                className={buttonVariants({ size: 'lg' }) + ' shrink-0'}
              >
                Start free trial →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Dropzone onFile={upload} />
      <p className="text-center text-xs text-muted-foreground">
        Want this every morning?{' '}
        <Link
          href="/pricing"
          className="font-medium text-foreground/80 underline underline-offset-2 hover:text-foreground"
        >
          See pricing →
        </Link>
      </p>
      {state.kind === 'error' && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="text-rose-500">{state.message}</span>
            <Button variant="outline" size="sm" onClick={reset}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
