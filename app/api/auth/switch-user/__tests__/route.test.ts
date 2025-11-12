/**
 * Tests for /api/auth/switch-user route
 */

import { POST } from '../route';
import { getUserProfile } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { mockSessionUsers, mockUserProfiles } from '@/test-utils/mockData';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/auth-wrapper');

describe('POST /api/auth/switch-user', () => {
  const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
  const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (body: any): any => {
    return {
      url: 'http://localhost:3004/api/auth/switch-user',
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      cookies: {
        get: jest.fn(),
        getAll: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      },
      json: jest.fn().mockResolvedValue(body),
    };
  };

  it('should switch to different user successfully', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const targetUser = mockUserProfiles.user;

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockResolvedValue(targetUser);

    const request = createMockRequest({ userId: targetUser.id });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain(targetUser.full_name);
    expect(data.user).toMatchObject({
      id: targetUser.id,
      email: targetUser.email,
      full_name: targetUser.full_name,
      app_role: targetUser.app_role,
    });
  });

  it('should set x-switched-user cookie', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const targetUser = mockUserProfiles.leader;

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockResolvedValue(targetUser);

    const request = createMockRequest({ userId: targetUser.id });
    const response = await POST(request);

    // Check cookie was set via NextResponse cookies API
    const cookie = response.cookies.get('x-switched-user');
    expect(cookie).toBeDefined();
    expect(cookie.value).toContain(targetUser.id);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const request = createMockRequest({ userId: 'user-123' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockGetUserProfile).not.toHaveBeenCalled();
  });

  it('should return 401 when auth data has no user', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ user: null, profile: null } as any);

    const request = createMockRequest({ userId: 'user-123' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when userId is missing', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('userId is required');
    expect(mockGetUserProfile).not.toHaveBeenCalled();
  });

  it('should return 400 when userId is null', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ userId: null });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('userId is required');
  });

  it('should return 400 when userId is empty string', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ userId: '' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('userId is required');
  });

  it('should return 404 when target user not found', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockResolvedValue(null);

    const request = createMockRequest({ userId: 'nonexistent-user' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should include all required user fields in response', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const targetUser = {
      ...mockUserProfiles.user,
      department: 'Engineering',
      title: 'Senior Engineer',
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockResolvedValue(targetUser);

    const request = createMockRequest({ userId: targetUser.id });
    const response = await POST(request);
    const data = await response.json();

    expect(data.user).toMatchObject({
      id: targetUser.id,
      email: targetUser.email,
      full_name: targetUser.full_name,
      app_role: targetUser.app_role,
      department: targetUser.department,
      title: targetUser.title,
    });
  });

  it('should handle user without app_role (defaults to user)', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const targetUser = {
      ...mockUserProfiles.user,
      app_role: undefined,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockResolvedValue(targetUser as any);

    const request = createMockRequest({ userId: targetUser.id });
    const response = await POST(request);
    const data = await response.json();

    expect(data.user.app_role).toBe('user');
  });

  it('should handle user without app_permissions (defaults to empty object)', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const targetUser = {
      ...mockUserProfiles.user,
      app_permissions: undefined,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockResolvedValue(targetUser as any);

    const request = createMockRequest({ userId: targetUser.id });
    const response = await POST(request);
    const data = await response.json();

    expect(data.user.app_permissions).toEqual({});
  });

  it('should return 500 when getUserProfile throws error', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest({ userId: 'user-123' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to switch user');
  });

  it('should return 500 when request.json() fails', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ userId: 'user-123' });
    request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to switch user');
  });

  it('should set cookie with correct attributes', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    const targetUser = mockUserProfiles.user;

    mockGetAuthenticatedUser.mockResolvedValue(mockAuthData);
    mockGetUserProfile.mockResolvedValue(targetUser);

    const request = createMockRequest({ userId: targetUser.id });
    const response = await POST(request);

    const cookie = response.cookies.get('x-switched-user');
    expect(cookie).toBeDefined();
    expect(cookie.path).toBe('/');
    expect(cookie.sameSite).toBe('lax');
    // In test environment, NODE_ENV is 'test', not 'production'
    expect(cookie.secure).toBe(false);
  });

  it('should allow switching between different user roles', async () => {
    const roles = [
      mockUserProfiles.admin,
      mockUserProfiles.leader,
      mockUserProfiles.user,
    ];

    for (const targetUser of roles) {
      jest.clearAllMocks();

      mockGetAuthenticatedUser.mockResolvedValue({
        user: mockSessionUsers.admin,
        profile: mockUserProfiles.admin,
      });
      mockGetUserProfile.mockResolvedValue(targetUser);

      const request = createMockRequest({ userId: targetUser.id });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.app_role).toBe(targetUser.app_role);
    }
  });
});
