'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';

import { cn } from '@/lib/utils';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type Props = {
  onFile: (f: File) => void;
  disabled?: boolean;
  idleLabel?: string;
};

export function PdfDropzone({
  onFile,
  disabled,
  idleLabel = 'Drag your resume PDF here',
}: Props) {
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
        className={cn(
          'flex flex-col items-center justify-center border border-dashed px-6 py-16 text-center transition-colors',
          isDragActive
            ? 'border-foreground'
            : 'border-border hover:border-foreground/60',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
      >
        <input {...getInputProps()} />
        <p className="text-[0.9375rem] font-medium text-foreground">
          {isDragActive ? 'Drop your resume…' : idleLabel}
        </p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          or click to choose a file · PDF, max 10 MB
        </p>
      </div>
      {localError && (
        <p className="mt-3 text-[0.8125rem] text-destructive" role="alert">
          {localError}
        </p>
      )}
    </div>
  );
}
