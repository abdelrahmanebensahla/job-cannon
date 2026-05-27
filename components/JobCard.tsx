import type { MatchedJob } from '@/lib/types';

function formatPosted(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const days = Math.max(0, Math.round((Date.now() - ms) / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/**
 * Job card per the locked design system. Pure typography — no ring, no
 * progress bar, no colored badge. No card background, no shadow. The
 * containing list applies the hairline border between cards via
 * `divide-y` so this component is self-contained but composes cleanly.
 */
export function JobCard({ job }: { job: MatchedJob }) {
  const posted = formatPosted(job.posted_at);

  return (
    <article className="grid gap-6 py-8 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-xl tracking-tight">{job.company}</h3>
          {job.location && (
            <span className="text-[0.8125rem] text-muted-foreground">{job.location}</span>
          )}
          {job.remote && (
            <span className="inline-flex items-center border border-border px-1.5 py-0.5 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              Remote
            </span>
          )}
        </div>

        <p className="mt-1 text-[0.9375rem] text-foreground">{job.title}</p>

        {posted && (
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">Posted {posted}</p>
        )}

        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground">
            <span className="group-open:hidden">Why this match ↓</span>
            <span className="hidden group-open:inline">Hide reasoning ↑</span>
          </summary>
          <p className="mt-3 max-w-prose whitespace-pre-line text-[0.9375rem] leading-relaxed text-foreground/80">
            {job.reasoning}
          </p>
        </details>

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex text-[0.8125rem] font-medium text-foreground underline-offset-4 hover:underline"
        >
          Apply ↗
        </a>
      </div>

      <div className="text-right sm:pl-8">
        <div className="font-display text-[2.75rem] leading-none tracking-tight tabular-nums">
          {Math.round(job.match_score)}
        </div>
        <div className="mt-1 text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          match
        </div>
      </div>
    </article>
  );
}
