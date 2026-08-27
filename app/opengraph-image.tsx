import { ImageResponse } from 'next/og';

// Social card for every page that doesn't override it. Built with next/og
// rather than a committed PNG so the copy stays editable in one place.
export const runtime = 'nodejs';
export const alt = 'Job Cannon — startup jobs, AI-matched to your resume';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          // Matches the locked palette in HANDOFF.md: paper white, near-black
          // ink, hairline rules. No gradients, no colour.
          background: '#FFFFFF',
          color: '#0A0A0A',
          padding: '72px 80px',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: '0.16em', color: '#737373' }}>
          JOB CANNON
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', fontSize: 82, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Startup jobs, AI-matched
          </div>
          <div style={{ display: 'flex', fontSize: 82, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#737373' }}>
            to your resume.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: '1px solid #E5E5E5',
            paddingTop: 28,
            fontSize: 24,
            color: '#737373',
            fontFamily: 'Helvetica, Arial, sans-serif',
          }}
        >
          <div style={{ display: 'flex' }}>Drop your resume. Get 20 matches free.</div>
          <div style={{ display: 'flex' }}>jobcannon.app</div>
        </div>
      </div>
    ),
    size,
  );
}
