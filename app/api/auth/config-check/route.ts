import { NextResponse } from 'next/server';

export async function GET() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  return NextResponse.json({
    status: 'OAuth Configuration Status',
    config: {
      googleClientId: googleClientId ? '✅ Set (first 10 chars: ' + googleClientId.substring(0, 10) + '...)' : '❌ Missing',
      googleClientSecret: googleClientSecret ? '✅ Set' : '❌ Missing',
      nextAuthUrl: nextAuthUrl || '❌ Missing',
      nextAuthSecret: nextAuthSecret ? '✅ Set' : '❌ Missing',
    },
    instructions: 'If any config shows ❌, update your .env file and restart the dev server',
    redirectUri: nextAuthUrl + '/api/auth/callback/google',
  });
}
