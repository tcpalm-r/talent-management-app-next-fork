/**
 * Tests for /api/users/list route
 */

import { GET } from '../route';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { mockSessionUsers, mockUserProfiles } from '@/test-utils/mockData';

// Mock supabase-admin (which the route actually uses)
const mockFrom = jest.fn();
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// Mock auth-wrapper
jest.mock('@/lib/auth-wrapper');

describe('GET /api/users/list', () => {
  const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Enable dev mode for these tests
    process.env = { ...originalEnv, DISABLE_AUTH: 'true' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to create mock supabase query chain
  const createMockQueryChain = (users: any[], error: any = null) => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: users, error }),
      }),
    }),
  });

  const createMockRequest = (): any => {
    // Minimal mock that satisfies NextRequest interface
    return {
      url: 'http://localhost:3004/api/users/list',
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

  it('should return list of active users when authenticated', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const mockUsers = [
      mockUserProfiles.admin,
      mockUserProfiles.leader,
      mockUserProfiles.user,
    ];

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockFrom.mockReturnValue(createMockQueryChain(mockUsers));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.users).toHaveLength(3);
    expect(data.users[0]).toMatchObject({
      id: expect.any(String),
      full_name: expect.any(String),
      email: expect.any(String),
      app_role: expect.any(String),
    });
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should return 401 when user is null in auth data', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ user: null, profile: null } as any);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('should map user fields correctly', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const mockUsers = [mockUserProfiles.admin];

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockFrom.mockReturnValue(createMockQueryChain(mockUsers));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(data.users[0]).toEqual({
      id: mockUsers[0].id,
      full_name: mockUsers[0].full_name,
      email: mockUsers[0].email,
      app_role: mockUsers[0].app_role,
      department: mockUsers[0].department,
    });
  });

  it('should default app_role to "user" when missing', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const userWithoutRole = {
      ...mockUserProfiles.user,
      app_role: null,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockFrom.mockReturnValue(createMockQueryChain([userWithoutRole]));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(data.users[0].app_role).toBe('user');
  });

  it('should handle empty user list', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockFrom.mockReturnValue(createMockQueryChain([]));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.users).toEqual([]);
  });

  it('should return 500 when database query fails', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockFrom.mockReturnValue(createMockQueryChain([], { message: 'Database connection failed' }));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to fetch users' });
  });

  it('should work for all authenticated roles', async () => {
    const roles = [
      { user: mockSessionUsers.admin, profile: mockUserProfiles.admin },
      { user: mockSessionUsers.leader, profile: mockUserProfiles.leader },
      { user: mockSessionUsers.user, profile: mockUserProfiles.user },
    ];

    for (const authData of roles) {
      jest.clearAllMocks();
      mockGetAuthenticatedUser.mockResolvedValue(authData);
      mockFrom.mockReturnValue(createMockQueryChain([mockUserProfiles.admin]));

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    }
  });

  it('should include department information when available', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const userWithDepartment = {
      ...mockUserProfiles.admin,
      department: { id: 'dept-1', name: 'Engineering' },
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockFrom.mockReturnValue(createMockQueryChain([userWithDepartment]));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(data.users[0].department).toEqual({ id: 'dept-1', name: 'Engineering' });
  });

  it('should handle users without department', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const userWithoutDepartment = {
      ...mockUserProfiles.user,
      department: null,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockFrom.mockReturnValue(createMockQueryChain([userWithoutDepartment]));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users[0].department).toBeNull();
  });
});
