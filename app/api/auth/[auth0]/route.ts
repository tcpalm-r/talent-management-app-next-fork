import { NextResponse } from 'next/server';

// TODO: Fix Auth0 integration - handleAuth is not exported in current version
// For now, return a placeholder response
export const GET = () => {
  return NextResponse.json({ message: 'Auth endpoint - needs Auth0 configuration' });
};

export const POST = () => {
  return NextResponse.json({ message: 'Auth endpoint - needs Auth0 configuration' });
};
