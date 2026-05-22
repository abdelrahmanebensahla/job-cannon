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
