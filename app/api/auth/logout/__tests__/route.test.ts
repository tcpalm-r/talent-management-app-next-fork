/**
 * Tests for /api/auth/logout route
 */

import { POST, GET } from '../route';

describe('POST /api/auth/logout', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AI_INTRANET_URL: 'https://test-intranet.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (): any => {
    return {
      url: 'http://localhost:3004/api/auth/logout',
      method: 'POST',
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

  it('should redirect to hub login with logout parameter', async () => {
    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(307); // Redirect status
    const location = response.headers.get('location');
    expect(location).toContain('https://test-intranet.com/login');
    // URL parameters are URL-encoded
    expect(location).toContain('returnTo=');
    expect(location).toContain('localhost%3A3004'); // encoded localhost:3004
    expect(location).toContain('logout=true');
  });

  it('should clear all session cookies', async () => {
    const request = createMockRequest();
    const response = await POST(request);

    // Check that cookies are deleted via NextResponse cookies API
    // When a cookie is deleted, it's set with empty value and expires in the past
    const userSessionCookie = response.cookies.get('user-session');
    const appSessionCookie = response.cookies.get('appSession');
    const intranetSessionCookie = response.cookies.get('ai-intranet-session');
    const intranetUserCookie = response.cookies.get('ai-intranet-user');

    // Deleted cookies are set with empty value and expired
    expect(userSessionCookie).toBeDefined();
    expect(userSessionCookie.value).toBe('');
    expect(appSessionCookie).toBeDefined();
    expect(appSessionCookie.value).toBe('');
    expect(intranetSessionCookie).toBeDefined();
    expect(intranetSessionCookie.value).toBe('');
    expect(intranetUserCookie).toBeDefined();
    expect(intranetUserCookie.value).toBe('');
  });

  it('should use fallback hub URL when AI_INTRANET_URL not set', async () => {
    delete process.env.AI_INTRANET_URL;
    delete process.env.NEXT_PUBLIC_AI_INTRANET_URL;

    const request = createMockRequest();
    const response = await POST(request);

    const location = response.headers.get('location');
    expect(location).toContain('https://aiintranet.sonance.com/login');
  });

  it('should use NEXT_PUBLIC_AI_INTRANET_URL as fallback', async () => {
    delete process.env.AI_INTRANET_URL;
    process.env.NEXT_PUBLIC_AI_INTRANET_URL = 'https://public-intranet.com';

    const request = createMockRequest();
    const response = await POST(request);

    const location = response.headers.get('location');
    expect(location).toContain('https://public-intranet.com/login');
  });

  it('should handle errors gracefully with fallback redirect', async () => {
    const request = createMockRequest();
    // Make nextUrl.origin throw an error
    Object.defineProperty(request.nextUrl, 'origin', {
      get() {
        throw new Error('Test error');
      }
    });

    const response = await POST(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('should preserve returnTo origin in redirect', async () => {
    const request = createMockRequest();
    request.nextUrl.origin = 'https://production.example.com';

    const response = await POST(request);

    const location = response.headers.get('location');
    // URL will be encoded
    expect(location).toContain('returnTo=');
    expect(location).toContain('production.example.com');
  });

  it('should handle multiple logout requests', async () => {
    const request1 = createMockRequest();
    const request2 = createMockRequest();

    const response1 = await POST(request1);
    const response2 = await POST(request2);

    expect(response1.status).toBe(307);
    expect(response2.status).toBe(307);
  });
});

describe('GET /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (): any => {
    return {
      url: 'http://localhost:3004/api/auth/logout',
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

  it('should delegate to POST handler', async () => {
    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('logout=true');
  });

  it('should clear cookies when called via GET', async () => {
    const request = createMockRequest();
    const response = await GET(request);

    // Check that cookies are deleted (set with empty value)
    const userSessionCookie = response.cookies.get('user-session');
    expect(userSessionCookie).toBeDefined();
    expect(userSessionCookie.value).toBe('');
  });
});
