import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check cache headers and environment
 */
export async function GET(request: NextRequest) {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
  };

  const response = NextResponse.json({
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substring(7),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 50) + '...',
      vercelEnv: process.env.VERCEL_ENV,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8),
    },
    headers: {
      userAgent: request.headers.get('user-agent'),
      cacheControl: request.headers.get('cache-control'),
      pragma: request.headers.get('pragma'),
    },
  });

  // Set cache-busting headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

