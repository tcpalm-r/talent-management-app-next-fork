/**
 * Tests for /api/auth/me route
 */

import { GET } from '../route';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { mockSessionUsers, mockUserProfiles } from '@/test-utils/mockData';

// Mock auth-wrapper
jest.mock('@/lib/auth-wrapper');

describe('GET /api/auth/me', () => {
  const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (): any => {
    // Minimal mock that satisfies NextRequest interface
    return {
      url: 'http://localhost:3004/api/auth/me',
      method: 'GET',
      headers: new Headers(),
      cookies: {
        get: jest.fn(),
        getAll: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      },
    };
  };

  it('should return user and profile when authenticated', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    });
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('should return user with different roles', async () => {
    const mockAuthData = {
      user: mockSessionUsers.leader,
      profile: mockUserProfiles.leader,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.app_role).toBe('leader');
  });

  it('should return 500 when authentication throws error', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('should handle null user in auth data', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ user: null, profile: null } as any);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    // Route returns the data even if user is null (authData object exists)
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ user: null, profile: null });
  });

  it('should return profile with all user fields', async () => {
    const mockAuthData = {
      user: mockSessionUsers.user,
      profile: mockUserProfiles.user,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(data.profile).toMatchObject({
      id: expect.any(String),
      full_name: expect.any(String),
      email: expect.any(String),
      app_role: expect.any(String),
    });
  });

  it('should work with various request headers', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest();
    request.headers.set('Authorization', 'Bearer token123');
    request.headers.set('Content-Type', 'application/json');

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetAuthenticatedUser).toHaveBeenCalledWith(request);
  });
});
