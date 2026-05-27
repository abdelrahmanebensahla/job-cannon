import type { Profile } from '@/lib/types';

const SENIORITY_LABEL: Record<Profile['seniority'], string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff+',
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center border border-border px-2.5 py-1 text-[0.8125rem] text-foreground">
      {children}
    </span>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-border py-5 sm:grid-cols-[10rem_1fr]">
      <div className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Bordered-chip rendering of an extracted Profile per the locked design
 * system. Replaces the old card-based ProfileSummary; same export name so
 * existing call sites (OnboardingClient post-upload preview, dashboard
 * resume page) keep working.
 */
export function ProfileSummary({ profile }: { profile: Profile }) {
  const sortedSkills = [...profile.skills].sort((a, b) => b.years - a.years);

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl tracking-tight">{profile.name}</h2>
        <span className="text-[0.8125rem] text-muted-foreground">
          {SENIORITY_LABEL[profile.seniority]}
        </span>
      </div>

      {profile.summary && (
        <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-muted-foreground">
          {profile.summary}
        </p>
      )}

      <div className="mt-8 border-b border-border">
        {profile.target_roles.length > 0 && (
          <FieldRow label="Targeting">
            {profile.target_roles.map(r => (
              <Chip key={r}>{r}</Chip>
            ))}
          </FieldRow>
        )}

        {sortedSkills.length > 0 && (
          <FieldRow label="Skills">
            {sortedSkills.map(s => (
              <Chip key={s.name}>
                {s.name}
                {s.years > 0 && (
                  <span className="ml-1 text-muted-foreground">· {s.years}y</span>
                )}
              </Chip>
            ))}
          </FieldRow>
        )}

        {profile.locations.length > 0 && (
          <FieldRow label="Locations">
            {profile.locations.map(l => (
              <Chip key={l}>{l}</Chip>
            ))}
          </FieldRow>
        )}

        <FieldRow label="Remote">
          <Chip>{profile.remote_ok ? 'Open to remote' : 'On-site preferred'}</Chip>
        </FieldRow>
      </div>
    </div>
  );
}
