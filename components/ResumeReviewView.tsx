import type { ResumeReview } from '@/lib/types';

/**
 * Presentational renderer for a ResumeReview. No 'use client' — same dual-use
 * pattern as ProfileSummary, so it works in both server and client trees.
 */

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-[0.9375rem] leading-relaxed">
          <span aria-hidden className="select-none text-muted-foreground">
            —
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h3 className="font-display text-xl tracking-tight">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ResumeReviewView({ review }: { review: ResumeReview }) {
  const {
    overall_score,
    summary,
    strengths,
    weaknesses,
    section_feedback,
    revision_suggestions,
    recommendations,
  } = review;

  return (
    <div className="space-y-8">
      <div className="border border-border p-6">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-5xl tracking-tight tabular-nums">{overall_score}</span>
          <span className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            / 100 · resume score
          </span>
        </div>
        <p className="mt-4 max-w-prose text-[0.9375rem] leading-relaxed text-muted-foreground">
          {summary}
        </p>
      </div>

      {strengths.length > 0 && (
        <Block title="Strengths">
          <Bullets items={strengths} />
        </Block>
      )}

      {weaknesses.length > 0 && (
        <Block title="Gaps & weaknesses">
          <Bullets items={weaknesses} />
        </Block>
      )}

      {section_feedback.length > 0 && (
        <Block title="Section-by-section">
          <div className="space-y-6">
            {section_feedback.map((s, i) => (
              <div key={i}>
                <h4 className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
                  {s.section}
                </h4>
                <p className="mt-1.5 max-w-prose text-[0.9375rem] leading-relaxed">{s.assessment}</p>
                {s.suggestions.length > 0 && (
                  <div className="mt-3">
                    <Bullets items={s.suggestions} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {revision_suggestions.length > 0 && (
        <Block title="Suggested revisions">
          <div className="space-y-5">
            {revision_suggestions.map((r, i) => (
              <div key={i} className="border border-border">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
                    Before
                  </p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">
                    {r.original}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
                    After
                  </p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-foreground">{r.revised}</p>
                </div>
                {r.rationale && (
                  <p className="border-t border-border px-4 py-2 text-[0.8125rem] text-muted-foreground">
                    {r.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {recommendations.length > 0 && (
        <Block title="Recommendations">
          <ol className="space-y-3">
            {recommendations.map((t, i) => (
              <li key={i} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                <span aria-hidden className="font-display tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </Block>
      )}
    </div>
  );
}
