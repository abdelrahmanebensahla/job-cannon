'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';

import { JobCard } from './JobCard';
import { PdfDropzone } from './PdfDropzone';
import { ProfileSummary } from './ProfileSummary';
import type { MatchedJob, Profile } from '@/lib/types';

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
  rate_limited:
    "You've used all of today's free previews. Try again tomorrow, or subscribe to get matches every weekday morning.",
  daily_capacity_reached:
    "The free preview has hit today's limit. Try again tomorrow, or subscribe to skip the queue.",
};

function ProcessingPanel({ fileName }: { fileName: string }) {
  return (
    <div className="border border-border px-6 py-10">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xl tracking-tight">Reading your resume…</p>
        <p className="text-[0.8125rem] text-muted-foreground">{fileName}</p>
      </div>
      <p className="mt-3 max-w-prose text-[0.9375rem] text-muted-foreground">
        Extracting your profile and ranking against 10,000+ fresh startup roles. Usually 15–30 seconds.
      </p>
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
      <div className="space-y-12">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-[0.8125rem] text-muted-foreground">From {state.fileName}</p>
            <h2 className="mt-1 font-display text-3xl tracking-tight">
              {state.results.length} matches
            </h2>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            Try another resume →
          </button>
        </div>

        <ProfileSummary profile={state.profile} />

        {state.results.length === 0 ? (
          <p className="border-t border-border pt-8 text-[0.9375rem] text-muted-foreground">
            No strong matches in the current job set. Try a resume with a different focus or check back after the next scrape.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {state.results.map(j => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}

        {state.results.length > 0 && (
          <div className="border-t-2 border-foreground pt-8">
            <h3 className="font-display text-2xl tracking-tight">
              Get this every weekday morning.
            </h3>
            <p className="mt-2 max-w-prose text-[0.9375rem] text-muted-foreground">
              $8/month or $60/year. 7-day free trial. Cancel anytime in the Stripe portal.
            </p>
            <Link
              href="/pricing"
              className="mt-5 inline-flex h-10 items-center border border-foreground bg-foreground px-5 text-[0.8125rem] font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Start free trial →
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PdfDropzone onFile={upload} idleLabel="Drag a resume PDF here" />
      <p className="text-center text-[0.8125rem] text-muted-foreground">
        Want this every morning?{' '}
        <Link
          href="/pricing"
          className="text-foreground underline underline-offset-2 transition-colors hover:text-foreground/80"
        >
          See pricing →
        </Link>
      </p>
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
