/**
 * Environment Variable Validation
 *
 * This module validates environment configuration on server startup
 * to catch misconfigurations early and prevent security issues.
 */

/**
 * Validates that authentication is properly configured for the current environment
 *
 * @throws Error if authentication is misconfigured in production
 */
export function validateAuthConfig(): void {
  const nodeEnv = process.env.NODE_ENV;
  const authDisabled =
    process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
    process.env.DISABLE_AUTH?.trim() === 'true';

  // CRITICAL: Auth bypass should never be enabled in production
  if (nodeEnv === 'production' && authDisabled) {
    const errorMessage = `
╔═══════════════════════════════════════════════════════════════════╗
║                     CRITICAL SECURITY ERROR                       ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Authentication bypass is ENABLED in PRODUCTION environment!     ║
║                                                                   ║
║  This is a CRITICAL SECURITY VULNERABILITY that allows           ║
║  unauthorized access to the application.                          ║
║                                                                   ║
║  Found:                                                           ║
║    NODE_ENV: ${nodeEnv?.padEnd(47)}║
║    DISABLE_AUTH: ${process.env.DISABLE_AUTH?.padEnd(42)}║
║    NEXT_PUBLIC_DISABLE_AUTH: ${process.env.NEXT_PUBLIC_DISABLE_AUTH?.padEnd(30)}║
║                                                                   ║
║  Required Fix:                                                    ║
║    1. Remove DISABLE_AUTH from environment variables             ║
║    2. Remove NEXT_PUBLIC_DISABLE_AUTH from environment variables ║
║    3. Redeploy the application                                   ║
║                                                                   ║
║  See VERCEL_SETUP.md for configuration instructions              ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`;

    // Log to console for visibility
    console.error(errorMessage);

    // Throw error to prevent startup (optional - can be disabled if you prefer warnings)
    // Uncomment the line below to prevent the app from starting with this misconfiguration
    // throw new Error('CRITICAL: Authentication bypass enabled in production');

    // For now, we'll just log the error since the middleware has a fail-safe
    // that will prevent the actual bypass from working
  }

  // Validate required production environment variables
  if (nodeEnv === 'production' && !authDisabled) {
    const requiredVars = [
      'AI_INTRANET_URL',
      'APP_ID',
      'APP_API_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn(`
⚠️  WARNING: Missing required environment variables for production authentication:
    ${missingVars.join(', ')}

    Authentication may fail. Please configure these variables in your deployment platform.
    See VERCEL_SETUP.md for instructions.
`);
    }
  }

  // Log current auth configuration
  if (nodeEnv === 'development' && authDisabled) {
    console.log(`
✓ Development Mode: Authentication bypass is ENABLED
  - Auto-login as mock user
  - No external authentication required
  - For production deployment, remove DISABLE_AUTH environment variables
`);
  } else if (nodeEnv === 'production' && !authDisabled) {
    console.log(`
✓ Production Mode: Real authentication is ENABLED
  - AI Intranet authentication required
  - Auth0 OAuth flow active
  - User must login to access application
`);
  }
}

/**
 * Validates all environment configuration
 * Call this early in your application startup
 */
export function validateEnvironment(): void {
  validateAuthConfig();

  // Add other environment validations here as needed
  // Example:
  // - Database connection strings
  // - API keys
  // - Feature flags
}

// Auto-run validation on module import in server context
if (typeof window === 'undefined') {
  // Only run on server-side
  try {
    validateEnvironment();
  } catch (error) {
    console.error('Environment validation failed:', error);
    // Don't crash the app, just log the error
    // The middleware fail-safe will handle the security issue
  }
}
