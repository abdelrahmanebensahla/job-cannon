'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileSummary } from './ProfileSummary';
import type { Profile } from '@/lib/types';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type State =
  | { kind: 'idle' }
  | { kind: 'processing'; fileName: string }
  | { kind: 'done'; profile: Profile; resumeId: string; fileName: string }
  | { kind: 'error'; message: string };

type ApiResponse =
  | { ok: true; resumeId: string; profile: Profile }
  | { ok: false; error: string };

const ERROR_COPY: Record<string, string> = {
  unauthorized: 'Your session expired. Sign in again.',
  missing_resume_field: 'No resume file received. Try again.',
  empty_resume: 'That file looked empty. Try a different PDF.',
  resume_too_large: 'PDF is over 10 MB. Trim it down and retry.',
  unsupported_media_type: 'Only PDF files are supported.',
  not_a_pdf: "That doesn't look like a real PDF.",
  invalid_form_data: 'Could not read the upload. Try again.',
  extraction_failed: "Claude couldn't read enough structure from that resume. Try a cleaner PDF.",
  user_not_provisioned: 'Your account is still being set up. Refresh and try again in a few seconds.',
  resume_insert_failed: "Couldn't save your resume. Please retry.",
  resume_persist_failed: 'A database error stopped your resume from saving. Please retry.',
};

function ProcessingPanel({ fileName }: { fileName: string }) {
  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Reading your resume…</p>
            <p className="text-xs text-muted-foreground">{fileName}</p>
          </div>
          <Progress value={null} />
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
          {isDragActive ? 'Drop your resume…' : 'Drag your resume PDF here'}
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

export function OnboardingClient() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const upload = useCallback(async (file: File) => {
    setState({ kind: 'processing', fileName: file.name });
    try {
      const form = new FormData();
      form.append('resume', file);
      const res = await fetch('/api/resume', { method: 'POST', body: form });
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
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Looks right?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what we pulled from <span className="font-medium">{state.fileName}</span>.
            If this is accurate, head to pricing to start your trial.
          </p>
        </div>
        <ProfileSummary profile={state.profile} />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/pricing" className={buttonVariants({ size: 'lg' })}>
            Continue to billing
          </Link>
          <Button variant="outline" size="lg" onClick={reset}>
            Try a different resume
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Dropzone onFile={upload} />
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
