import { clerkMiddleware } from '@clerk/nextjs/server';

// Phase 0: just enable Clerk on every relevant request. Route protection
// (e.g. /dashboard/* requires an active subscription) lands in Phase 2.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and static assets.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
