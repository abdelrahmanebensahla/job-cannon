import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MatchScoreRing } from './MatchScoreRing';
import type { MatchedJob } from '@/lib/types';

const SOURCE_LABEL: Record<MatchedJob['source'], string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  remoteok: 'RemoteOK',
};

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

export function JobCard({ job }: { job: MatchedJob }) {
  const posted = formatPosted(job.posted_at);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <MatchScoreRing score={job.match_score} size={64} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold tracking-tight">{job.title}</h3>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm font-medium text-muted-foreground">{job.company}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {job.location && <span className="truncate max-w-[18rem]">{job.location}</span>}
            {job.remote && <Badge variant="secondary">Remote</Badge>}
            {posted && <span>· {posted}</span>}
            <Badge variant="outline" className="ml-auto">
              {SOURCE_LABEL[job.source]}
            </Badge>
          </div>

          <details className="group mt-3">
            <summary className="cursor-pointer list-none text-sm text-foreground/90 hover:underline">
              <span className="group-open:hidden">Why this fits ▸</span>
              <span className="hidden group-open:inline">Why this fits ▾</span>
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {job.reasoning}
            </p>
          </details>

          <div className="mt-4">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              View job →
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
