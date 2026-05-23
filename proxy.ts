import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Authed routes: any /dashboard/* and /onboarding require a signed-in user.
// The /dashboard/* subscription check happens in the dashboard layout
// (kept out of middleware to avoid a Neon DB hit on every nav).
const isAuthed = createRouteMatcher(['/dashboard(.*)', '/onboarding(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAuthed(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static assets.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
