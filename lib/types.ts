import { z } from 'zod';

export type JobSource = 'greenhouse' | 'lever' | 'remoteok';

export const JobSchema = z.object({
  id: z.string(),
  source: z.enum(['greenhouse', 'lever', 'remoteok']),
  company: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  remote: z.boolean(),
  description: z.string(),
  url: z.string(),
  posted_at: z.string(),
});

export type Job = z.infer<typeof JobSchema>;

export const ProfileSchema = z.object({
  name: z.string(),
  target_roles: z.array(z.string()).min(1),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'staff']),
  skills: z
    .array(
      z.object({
        name: z.string(),
        years: z.number(),
      }),
    )
    .min(1),
  locations: z.array(z.string()),
  remote_ok: z.boolean(),
  summary: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const RankedJobsSchema = z.object({
  rankings: z
    .array(
      z.object({
        job_id: z.string(),
        match_score: z.number().min(0).max(100),
        reasoning: z.string().max(400),
      }),
    )
    .max(20),
});

export type RankedJobs = z.infer<typeof RankedJobsSchema>;

export type MatchedJob = Job & {
  match_score: number;
  reasoning: string;
};

// Kept intentionally lean: bounded output keeps a single generation well under
// the route's timeout (see lib/ai/review.ts) and avoids retries.
export const ResumeReviewSchema = z.object({
  overall_score: z.number().min(0).max(100),
  summary: z.string().max(500),
  strengths: z.array(z.string().max(220)).max(4),
  weaknesses: z.array(z.string().max(220)).max(4),
  section_feedback: z
    .array(
      z.object({
        section: z.string().max(60),
        assessment: z.string().max(280),
        suggestions: z.array(z.string().max(180)).max(2),
      }),
    )
    .max(3),
  revision_suggestions: z
    .array(
      z.object({
        original: z.string().max(320),
        revised: z.string().max(320),
        rationale: z.string().max(220),
      }),
    )
    .max(3),
  recommendations: z.array(z.string().max(220)).max(5),
});

export type ResumeReview = z.infer<typeof ResumeReviewSchema>;
