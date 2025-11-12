/**
 * Tests for /api/auth/login route
 */

import { GET } from '../route';

describe('GET /api/auth/login', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_DISABLE_AUTH: 'false',
      DISABLE_AUTH: 'false',
      AUTH0_ISSUER_BASE_URL: 'https://test.auth0.com',
      AUTH0_CLIENT_ID: 'test-client-id',
      AUTH0_BASE_URL: 'http://localhost:3004',
      AUTH0_CLIENT_SECRET: 'test-secret',
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (): any => {
    return {
      url: 'http://localhost:3004/api/auth/login',
      method: 'GET',
      headers: new Headers(),
      nextUrl: {
        origin: 'http://localhost:3004',
      },
      cookies: {
        get: jest.fn(),
        getAll: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      },
    };
  };

  it('should redirect to Auth0 authorize URL when auth is enabled', async () => {
    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(307); // Redirect
    const location = response.headers.get('location');
    expect(location).toContain('https://test.auth0.com/authorize');
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('response_type=code');
    expect(location).toContain('scope=openid');
  });

  it('should include correct redirect_uri in Auth0 URL', async () => {
    const request = createMockRequest();
    const response = await GET(request);

    const location = response.headers.get('location');
    expect(location).toContain('redirect_uri=');
    expect(location).toContain('callback');
  });

  it('should redirect to home when NEXT_PUBLIC_DISABLE_AUTH is true', async () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH = 'true';

    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3004/');
  });

  it('should redirect to home when DISABLE_AUTH is true', async () => {
    delete process.env.NEXT_PUBLIC_DISABLE_AUTH;
    process.env.DISABLE_AUTH = 'true';

    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3004/');
  });

  it('should handle DISABLE_AUTH with trailing whitespace', async () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH = 'true\n';

    const request = createMockRequest();
    const response = await GET(request);

    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3004/');
  });

  it('should return 500 when AUTH0_ISSUER_BASE_URL is missing', async () => {
    delete process.env.AUTH0_ISSUER_BASE_URL;

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Auth0 configuration missing');
    expect(data.debug.auth0Domain).toBe(false);
  });

  it('should return 500 when AUTH0_CLIENT_ID is missing', async () => {
    delete process.env.AUTH0_CLIENT_ID;

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Auth0 configuration missing');
    expect(data.debug.clientId).toBe(false);
  });

  it('should return 500 when both AUTH0 vars are missing', async () => {
    delete process.env.AUTH0_ISSUER_BASE_URL;
    delete process.env.AUTH0_CLIENT_ID;

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.debug.auth0Domain).toBe(false);
    expect(data.debug.clientId).toBe(false);
  });

  it('should parse Auth0 domain correctly', async () => {
    process.env.AUTH0_ISSUER_BASE_URL = 'https://my-tenant.us.auth0.com';

    const request = createMockRequest();
    const response = await GET(request);

    const location = response.headers.get('location');
    expect(location).toContain('https://my-tenant.us.auth0.com/authorize');
  });

  it('should include all required OAuth parameters', async () => {
    const request = createMockRequest();
    const response = await GET(request);

    const location = response.headers.get('location');
    expect(location).toContain('client_id=');
    expect(location).toContain('response_type=code');
    expect(location).toContain('scope=openid+profile+email');
    expect(location).toContain('redirect_uri=');
  });

  it('should use AUTH0_BASE_URL for redirect_uri', async () => {
    process.env.AUTH0_BASE_URL = 'https://production.example.com';

    const request = createMockRequest();
    const response = await GET(request);

    const location = response.headers.get('location');
    const url = new URL(location);
    const redirectUri = url.searchParams.get('redirect_uri');

    expect(redirectUri).toContain('https://production.example.com');
    expect(redirectUri).toContain('/api/auth/callback');
  });

  it('should handle different request origins', async () => {
    const request = createMockRequest();
    request.nextUrl.origin = 'https://staging.example.com';

    const response = await GET(request);

    expect(response.status).toBe(307);
    // Should redirect to Auth0, not back to the request origin
    const location = response.headers.get('location');
    expect(location).toContain('auth0.com');
  });

  it('should not redirect to Auth0 when auth disabled even if config present', async () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH = 'true';

    const request = createMockRequest();
    const response = await GET(request);

    const location = response.headers.get('location');
    expect(location).not.toContain('auth0.com');
    expect(location).toBe('http://localhost:3004/');
  });

  it('should handle errors when auth disabled with invalid config', async () => {
    // When auth is disabled, it should redirect to home even if other errors occur
    process.env.NEXT_PUBLIC_DISABLE_AUTH = 'true';
    delete process.env.AUTH0_ISSUER_BASE_URL;
    delete process.env.AUTH0_CLIENT_ID;

    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toBe('http://localhost:3004/');
  });

  it('should handle missing AUTH0_BASE_URL', async () => {
    delete process.env.AUTH0_BASE_URL;

    const request = createMockRequest();
    const response = await GET(request);

    const location = response.headers.get('location');
    // redirect_uri should use undefined which becomes "undefined" string
    expect(location).toContain('redirect_uri=');
  });
});
