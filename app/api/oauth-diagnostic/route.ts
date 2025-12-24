import { NextResponse } from 'next/server';

export async function GET() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL;

  const expectedRedirectUri = `${nextAuthUrl}/api/auth/callback/google`;

  return NextResponse.json({
    status: 'OAuth Configuration Diagnostic',
    timestamp: new Date().toISOString(),
    config: {
      googleClientId: googleClientId ? `Set (${googleClientId.substring(0, 20)}...)` : '❌ MISSING',
      googleClientSecret: googleClientSecret ? 'Set' : '❌ MISSING',
      nextAuthUrl: nextAuthUrl || '❌ MISSING',
      expectedRedirectUri: expectedRedirectUri,
    },
    instructions: {
      step1: 'Go to https://console.cloud.google.com/',
      step2: 'Find your OAuth 2.0 Client ID (Web application)',
      step3: 'Verify these redirect URIs are configured:',
      step3a: '  - http://localhost:3000/api/auth/callback/google',
      step3b: '  - http://localhost:3000',
      step4: 'Verify Authorized JavaScript origins:',
      step4a: '  - http://localhost:3000',
      step5: 'If any are missing, add them and save',
      step6: 'Copy the latest Client ID and Client Secret',
      step7: 'Update .env file with new credentials',
      step8: 'Restart dev server: npm run dev',
    },
    commonIssues: {
      issue1: 'Redirect URI mismatch - Must be exactly: http://localhost:3000/api/auth/callback/google',
      issue2: 'Client ID/Secret invalid - May need to regenerate in Google Cloud',
      issue3: 'Wrong application type - Must be "Web application" not "Mobile"',
      issue4: 'Port mismatch - Your app runs on :3000, not :3001',
    },
  });
}
