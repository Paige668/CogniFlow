import { clerkMiddleware } from '@clerk/nextjs/server';

// Next.js 16 calls this file proxy.ts (middleware.ts before 16). It gives Clerk the request
// context it needs; the API checks the session token itself on every call.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
};
