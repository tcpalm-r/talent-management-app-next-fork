import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Helper function to check if a variable is set
  const isSet = (value: string | undefined): string => {
    if (!value) return '❌ NOT SET';
    if (value.includes('***')) return '✓ MASKED';
    return '✓ SET';
  };

  // Helper to safely display values (mask secrets)
  const maskSecret = (value: string | undefined, key: string): string => {
    if (!value) return 'NOT SET';
    if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD') || key.includes('TOKEN')) {
      return `***${value.slice(-6)}`;
    }
    return value;
  };

  const envVars = {
    // Supabase Configuration
    supabase: {
      'NEXT_PUBLIC_SUPABASE_URL': {
        status: isSet(process.env.NEXT_PUBLIC_SUPABASE_URL),
        value: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...` : 'NOT SET'
      },
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': {
        status: isSet(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        value: maskSecret(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY')
      },
      'SUPABASE_SERVICE_ROLE_KEY': {
        status: isSet(process.env.SUPABASE_SERVICE_ROLE_KEY),
        value: maskSecret(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
      },
      'SUPABASE_DB_URL': {
        status: isSet(process.env.SUPABASE_DB_URL),
        value: process.env.SUPABASE_DB_URL ? '***MASKED***' : 'NOT SET'
      },
      'DATABASE_URL': {
        status: isSet(process.env.DATABASE_URL),
        value: process.env.DATABASE_URL ? '***MASKED***' : 'NOT SET'
      },
    },

    // Anthropic AI
    anthropic: {
      'ANTHROPIC_API_KEY': {
        status: isSet(process.env.ANTHROPIC_API_KEY),
        value: maskSecret(process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'),
        issue: process.env.ANTHROPIC_API_KEY ? null : '⚠️ Missing - Required for AI features'
      },
    },

    // Email Configuration
    email: {
      'RESEND_API_KEY': {
        status: isSet(process.env.RESEND_API_KEY),
        value: maskSecret(process.env.RESEND_API_KEY, 'RESEND_API_KEY')
      },
      'RESEND_FROM_EMAIL': {
        status: isSet(process.env.RESEND_FROM_EMAIL),
        value: process.env.RESEND_FROM_EMAIL || 'NOT SET (will use default)'
      },
      'RESEND_FROM_NAME': {
        status: isSet(process.env.RESEND_FROM_NAME),
        value: process.env.RESEND_FROM_NAME || 'Sonance 360 Feedback (default)'
      },
      'ADMIN_EMAIL': {
        status: isSet(process.env.ADMIN_EMAIL),
        value: process.env.ADMIN_EMAIL || 'NOT SET'
      },
    },

    // Authentication
    auth: {
      'NEXT_PUBLIC_DISABLE_AUTH': {
        status: isSet(process.env.NEXT_PUBLIC_DISABLE_AUTH),
        value: process.env.NEXT_PUBLIC_DISABLE_AUTH || 'NOT SET'
      },
      'DISABLE_AUTH': {
        status: isSet(process.env.DISABLE_AUTH),
        value: process.env.DISABLE_AUTH || 'NOT SET (should be NEXT_PUBLIC_DISABLE_AUTH)'
      },
      'AUTH0_SECRET': {
        status: isSet(process.env.AUTH0_SECRET),
        value: maskSecret(process.env.AUTH0_SECRET, 'AUTH0_SECRET')
      },
      'AUTH0_BASE_URL': {
        status: isSet(process.env.AUTH0_BASE_URL),
        value: process.env.AUTH0_BASE_URL || 'NOT SET'
      },
      'AUTH0_ISSUER_BASE_URL': {
        status: isSet(process.env.AUTH0_ISSUER_BASE_URL),
        value: process.env.AUTH0_ISSUER_BASE_URL || 'NOT SET'
      },
      'AUTH0_CLIENT_ID': {
        status: isSet(process.env.AUTH0_CLIENT_ID),
        value: process.env.AUTH0_CLIENT_ID || 'NOT SET'
      },
      'AUTH0_CLIENT_SECRET': {
        status: isSet(process.env.AUTH0_CLIENT_SECRET),
        value: maskSecret(process.env.AUTH0_CLIENT_SECRET, 'AUTH0_CLIENT_SECRET')
      },
    },

    // AI Intranet
    aiIntranet: {
      'APP_ID': {
        status: isSet(process.env.APP_ID),
        value: process.env.APP_ID || 'NOT SET'
      },
      'NEXT_PUBLIC_APP_ID': {
        status: isSet(process.env.NEXT_PUBLIC_APP_ID),
        value: process.env.NEXT_PUBLIC_APP_ID || 'NOT SET'
      },
      'APP_API_KEY': {
        status: isSet(process.env.APP_API_KEY),
        value: maskSecret(process.env.APP_API_KEY, 'APP_API_KEY')
      },
      'LOCAL_TESTING_MODE': {
        status: isSet(process.env.LOCAL_TESTING_MODE),
        value: process.env.LOCAL_TESTING_MODE || 'NOT SET'
      },
      'AI_INTRANET_URL_LOCAL': {
        status: isSet(process.env.AI_INTRANET_URL_LOCAL),
        value: process.env.AI_INTRANET_URL_LOCAL || 'NOT SET'
      },
      'AI_INTRANET_URL_PROD': {
        status: isSet(process.env.AI_INTRANET_URL_PROD),
        value: process.env.AI_INTRANET_URL_PROD || 'NOT SET'
      },
      'AI_INTRANET_URL': {
        status: isSet(process.env.AI_INTRANET_URL),
        value: process.env.AI_INTRANET_URL || 'NOT SET'
      },
    },

    // Application Configuration
    app: {
      'NODE_ENV': {
        status: isSet(process.env.NODE_ENV),
        value: process.env.NODE_ENV || 'NOT SET'
      },
      'NEXT_PUBLIC_APP_URL': {
        status: isSet(process.env.NEXT_PUBLIC_APP_URL),
        value: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET'
      },
      'APP_NAME': {
        status: isSet(process.env.APP_NAME),
        value: process.env.APP_NAME || 'NOT SET'
      },
    },

    // Deployment
    deployment: {
      'VERCEL_OIDC_TOKEN': {
        status: isSet(process.env.VERCEL_OIDC_TOKEN),
        value: maskSecret(process.env.VERCEL_OIDC_TOKEN, 'VERCEL_OIDC_TOKEN')
      },
    }
  };

  // Count issues
  const allVars = Object.values(envVars).flatMap(section => Object.values(section));
  const criticalIssues = allVars.filter(v => v.status === '❌ NOT SET');

  return NextResponse.json({
    summary: {
      timestamp: new Date().toISOString(),
      totalVariables: allVars.length,
      criticalMissing: criticalIssues.length,
      status: criticalIssues.length === 0 ? '✅ All critical variables set' : '⚠️ Some critical variables missing'
    },
    variables: envVars,
    criticalIssues: criticalIssues.map((v, i) => `Issue ${i + 1}: Check configuration`)
  });
}
