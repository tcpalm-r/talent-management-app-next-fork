import { NextResponse } from 'next/server';

export async function GET() {
  const auth0Vars = {
    AUTH0_SECRET: process.env.AUTH0_SECRET ? '***' : 'NOT SET',
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL,
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET ? '***' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  };

  console.log('[ENV Debug] Auth0 Environment Variables:', auth0Vars);

  return NextResponse.json({
    auth0: auth0Vars,
    timestamp: new Date().toISOString()
  });
}
