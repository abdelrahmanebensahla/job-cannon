import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Profile } from '@/lib/types';

const SENIORITY_LABEL: Record<Profile['seniority'], string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff+',
};

export function ProfileSummary({ profile }: { profile: Profile }) {
  const topSkills = [...profile.skills]
    .sort((a, b) => b.years - a.years)
    .slice(0, 10);
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{profile.name}</h2>
          <Badge variant="secondary">{SENIORITY_LABEL[profile.seniority]}</Badge>
          {profile.remote_ok && <Badge variant="outline">Remote OK</Badge>}
        </div>

        {profile.target_roles.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Targeting:{' '}
            <span className="text-foreground/90">{profile.target_roles.join(', ')}</span>
          </div>
        )}

        {profile.locations.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Locations:{' '}
            <span className="text-foreground/90">{profile.locations.join(', ')}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {topSkills.map(s => (
            <Badge key={s.name} variant="outline" className="font-normal">
              {s.name}
              {s.years > 0 && (
                <span className="ml-1 text-muted-foreground">· {s.years}y</span>
              )}
            </Badge>
          ))}
        </div>

        {profile.summary && (
          <p className="text-sm text-muted-foreground">{profile.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
