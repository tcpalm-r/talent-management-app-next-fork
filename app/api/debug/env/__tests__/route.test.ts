/**
 * Tests for /api/debug/env route
 */

import { GET } from '../route';

describe('GET /api/debug/env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up comprehensive environment variables for testing
    process.env = {
      ...originalEnv,
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJ0ZXN0LWFub24ta2V5',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJ0ZXN0LXNlcnZpY2Uta2V5',
      SUPABASE_DB_URL: 'postgresql://user:pass@host:5432/db',
      DATABASE_URL: 'postgresql://user:pass@host:5432/db',
      // Anthropic
      ANTHROPIC_API_KEY: 'sk-ant-test-key-123456',
      NEXT_PUBLIC_ANTHROPIC_API_KEY: 'sk-ant-public-test-key-123456',
      // Email
      RESEND_API_KEY: 're_test_key_123456',
      RESEND_FROM_EMAIL: 'test@example.com',
      ADMIN_EMAIL: 'admin@example.com',
      // Auth
      NEXT_PUBLIC_DISABLE_AUTH: 'true',
      DISABLE_AUTH: 'true',
      AUTH0_SECRET: 'auth0-secret-key-123456',
      AUTH0_BASE_URL: 'http://localhost:3004',
      AUTH0_ISSUER_BASE_URL: 'https://test.auth0.com',
      AUTH0_CLIENT_ID: 'test-client-id',
      AUTH0_CLIENT_SECRET: 'test-client-secret-123456',
      // AI Intranet
      APP_ID: 'test-app-id',
      NEXT_PUBLIC_APP_ID: 'test-public-app-id',
      APP_API_KEY: 'test-app-api-key-123456',
      LOCAL_TESTING_MODE: 'true',
      AI_INTRANET_URL_LOCAL: 'http://localhost:3001',
      AI_INTRANET_URL_PROD: 'https://aiintranet.sonance.com',
      AI_INTRANET_URL: 'http://localhost:3001',
      // App
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3004',
      APP_NAME: 'Talent Management',
      // Deployment
      VERCEL_OIDC_TOKEN: 'vercel-token-123456',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return environment variable status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('variables');
    expect(data).toHaveProperty('criticalIssues');
  });

  it('should include summary with timestamp and counts', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.summary).toMatchObject({
      timestamp: expect.any(String),
      totalVariables: expect.any(Number),
      criticalMissing: expect.any(Number),
      status: expect.any(String),
    });
  });

  it('should mask secret values', async () => {
    const response = await GET();
    const data = await response.json();

    // Check that API keys are masked
    const anthropicKey = data.variables.anthropic.ANTHROPIC_API_KEY;
    expect(anthropicKey.value).toContain('***');
    expect(anthropicKey.value).not.toContain('sk-ant-test-key');

    const resendKey = data.variables.email.RESEND_API_KEY;
    expect(resendKey.value).toContain('***');

    const auth0Secret = data.variables.auth.AUTH0_SECRET;
    expect(auth0Secret.value).toContain('***');
  });

  it('should show last 6 characters of secrets', async () => {
    const response = await GET();
    const data = await response.json();

    const anthropicKey = data.variables.anthropic.ANTHROPIC_API_KEY;
    expect(anthropicKey.value).toMatch(/\*\*\*\d{6}$/);
  });

  it('should not mask non-secret values', async () => {
    const response = await GET();
    const data = await response.json();

    const appUrl = data.variables.app.NEXT_PUBLIC_APP_URL;
    expect(appUrl.value).toBe('http://localhost:3004');

    const nodeEnv = data.variables.app.NODE_ENV;
    expect(nodeEnv.value).toBe('test');
  });

  it('should mark set variables with checkmark', async () => {
    const response = await GET();
    const data = await response.json();

    const supabaseUrl = data.variables.supabase.NEXT_PUBLIC_SUPABASE_URL;
    expect(supabaseUrl.status).toBe('✓ SET');

    const resendKey = data.variables.email.RESEND_API_KEY;
    expect(resendKey.status).toBe('✓ SET');
  });

  it('should mark missing variables with X', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const response = await GET();
    const data = await response.json();

    const resendKey = data.variables.email.RESEND_API_KEY;
    expect(resendKey.status).toBe('❌ NOT SET');

    const anthropicKey = data.variables.anthropic.ANTHROPIC_API_KEY;
    expect(anthropicKey.status).toBe('❌ NOT SET');
  });

  it('should count critical missing variables', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.RESEND_API_KEY;

    const response = await GET();
    const data = await response.json();

    expect(data.summary.criticalMissing).toBeGreaterThan(0);
    expect(data.summary.status).toContain('⚠️');
  });

  it('should show success status when all variables set', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.summary.status).toBe('✅ All critical variables set');
    expect(data.summary.criticalMissing).toBe(0);
  });

  it('should truncate long URLs', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://very-long-project-name-here-that-exceeds-thirty-characters.supabase.co';

    const response = await GET();
    const data = await response.json();

    const supabaseUrl = data.variables.supabase.NEXT_PUBLIC_SUPABASE_URL;
    expect(supabaseUrl.value).toContain('...');
    expect(supabaseUrl.value.length).toBeLessThan(100);
  });

  it('should mask database URLs', async () => {
    const response = await GET();
    const data = await response.json();

    const dbUrl = data.variables.supabase.SUPABASE_DB_URL;
    expect(dbUrl.value).toBe('***MASKED***');

    const databaseUrl = data.variables.supabase.DATABASE_URL;
    expect(databaseUrl.value).toBe('***MASKED***');
  });

  it('should include all major configuration sections', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.variables).toHaveProperty('supabase');
    expect(data.variables).toHaveProperty('anthropic');
    expect(data.variables).toHaveProperty('email');
    expect(data.variables).toHaveProperty('auth');
    expect(data.variables).toHaveProperty('aiIntranet');
    expect(data.variables).toHaveProperty('app');
    expect(data.variables).toHaveProperty('deployment');
  });

  it('should handle completely empty environment', async () => {
    process.env = {};

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.criticalMissing).toBeGreaterThan(0);
    expect(data.summary.status).toContain('⚠️');
  });

  it('should show NOT SET for undefined variables', async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.APP_NAME;

    const response = await GET();
    const data = await response.json();

    const adminEmail = data.variables.email.ADMIN_EMAIL;
    expect(adminEmail.value).toBe('NOT SET');

    const appName = data.variables.app.APP_NAME;
    expect(appName.value).toBe('NOT SET');
  });

  it('should include timestamp in ISO format', async () => {
    const response = await GET();
    const data = await response.json();

    const timestamp = data.summary.timestamp;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should handle partial Anthropic configuration', async () => {
    delete process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    const response = await GET();
    const data = await response.json();

    const serverKey = data.variables.anthropic.ANTHROPIC_API_KEY;
    expect(serverKey.status).toBe('✓ SET');

    const publicKey = data.variables.anthropic.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    expect(publicKey.status).toBe('❌ NOT SET');
  });

  it('should note issue with missing ANTHROPIC_API_KEY', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await GET();
    const data = await response.json();

    const anthropicKey = data.variables.anthropic.ANTHROPIC_API_KEY;
    expect(anthropicKey.issue).toContain('Missing');
    expect(anthropicKey.issue).toContain('NEXT_PUBLIC_ANTHROPIC_API_KEY');
  });

  it('should show fallback message for RESEND_FROM_EMAIL', async () => {
    delete process.env.RESEND_FROM_EMAIL;

    const response = await GET();
    const data = await response.json();

    const fromEmail = data.variables.email.RESEND_FROM_EMAIL;
    expect(fromEmail.value).toContain('NOT SET (will use default)');
  });

  it('should show note for DISABLE_AUTH usage when not set', async () => {
    delete process.env.DISABLE_AUTH;

    const response = await GET();
    const data = await response.json();

    const disableAuth = data.variables.auth.DISABLE_AUTH;
    expect(disableAuth.value).toContain('should be NEXT_PUBLIC_DISABLE_AUTH');
  });

  it('should return different counts based on configuration', async () => {
    const response1 = await GET();
    const data1 = await response1.json();
    const count1 = data1.summary.totalVariables;

    // Remove some variables
    delete process.env.ADMIN_EMAIL;
    delete process.env.APP_NAME;

    const response2 = await GET();
    const data2 = await response2.json();
    const count2 = data2.summary.totalVariables;

    // Total count should be the same (all variables are counted, even if NOT SET)
    expect(count1).toBe(count2);
  });
});
