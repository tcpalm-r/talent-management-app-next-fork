/**
 * Tests for /api/auth/validate-token route
 */

import { POST } from '../route';
import { validateAndSyncSession } from '@/lib/auth-wrapper';
import { createAuthenticatedResponse } from '@/lib/auth';
import { mockSessionUsers, mockUserProfiles } from '@/test-utils/mockData';

// Mock dependencies
jest.mock('@/lib/auth-wrapper');
jest.mock('@/lib/auth');

describe('POST /api/auth/validate-token', () => {
  const mockValidateAndSyncSession = validateAndSyncSession as jest.MockedFunction<typeof validateAndSyncSession>;
  const mockCreateAuthenticatedResponse = createAuthenticatedResponse as jest.MockedFunction<typeof createAuthenticatedResponse>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for createAuthenticatedResponse - returns the response as-is with cookies
    mockCreateAuthenticatedResponse.mockImplementation((response: any) => response);
  });

  const createMockRequest = (body: any): any => {
    return {
      url: 'http://localhost:3004/api/auth/validate-token',
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

  it('should validate token and return user data', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockValidateAndSyncSession.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ token: 'valid-token-123' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    });
    expect(mockValidateAndSyncSession).toHaveBeenCalledWith('valid-token-123');
  });

  it('should return 400 when token is missing', async () => {
    const request = createMockRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Token is required' });
    expect(mockValidateAndSyncSession).not.toHaveBeenCalled();
  });

  it('should return 400 when token is null', async () => {
    const request = createMockRequest({ token: null });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Token is required' });
  });

  it('should return 400 when token is empty string', async () => {
    const request = createMockRequest({ token: '' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Token is required' });
  });

  it('should return 401 when token is invalid', async () => {
    mockValidateAndSyncSession.mockResolvedValue(null);

    const request = createMockRequest({ token: 'invalid-token' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Invalid or expired token' });
  });

  it('should return 401 when token is expired', async () => {
    mockValidateAndSyncSession.mockResolvedValue(null);

    const request = createMockRequest({ token: 'expired-token' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Invalid or expired token' });
  });

  it('should set auth cookies on successful validation', async () => {
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockValidateAndSyncSession.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ token: 'valid-token' });
    await POST(request);

    expect(mockCreateAuthenticatedResponse).toHaveBeenCalledWith(
      expect.anything(),
      mockSessionUsers.admin,
      'valid-token'
    );
  });

  it('should handle validation errors gracefully', async () => {
    mockValidateAndSyncSession.mockRejectedValue(new Error('Database connection failed'));

    const request = createMockRequest({ token: 'valid-token' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('should validate tokens for different user roles', async () => {
    const roles = [
      { user: mockSessionUsers.admin, profile: mockUserProfiles.admin },
      { user: mockSessionUsers.leader, profile: mockUserProfiles.leader },
      { user: mockSessionUsers.user, profile: mockUserProfiles.user },
    ];

    for (const authData of roles) {
      jest.clearAllMocks();
      mockValidateAndSyncSession.mockResolvedValue(authData);

      const request = createMockRequest({ token: 'token-for-' + authData.user.app_role });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.app_role).toBe(authData.user.app_role);
    }
  });

  it('should handle malformed request body', async () => {
    const request = createMockRequest({ token: 'valid-token' });
    request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('should return success: true on valid token', async () => {
    const mockAuthData = {
      user: mockSessionUsers.user,
      profile: mockUserProfiles.user,
    };

    mockValidateAndSyncSession.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ token: 'token123' });
    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
  });

  it('should include both user and profile in response', async () => {
    const mockAuthData = {
      user: mockSessionUsers.leader,
      profile: mockUserProfiles.leader,
    };

    mockValidateAndSyncSession.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ token: 'token' });
    const response = await POST(request);
    const data = await response.json();

    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('profile');
    expect(data.user).toEqual(mockSessionUsers.leader);
    expect(data.profile).toEqual(mockUserProfiles.leader);
  });

  it('should handle very long tokens', async () => {
    const longToken = 'a'.repeat(1000);
    const mockAuthData = {
      user: mockSessionUsers.user,
      profile: mockUserProfiles.user,
    };

    mockValidateAndSyncSession.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ token: longToken });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockValidateAndSyncSession).toHaveBeenCalledWith(longToken);
  });

  it('should handle tokens with special characters', async () => {
    const specialToken = 'token-with-special.chars_123!@#';
    const mockAuthData = {
      user: mockSessionUsers.admin,
      profile: mockUserProfiles.admin,
    };

    mockValidateAndSyncSession.mockResolvedValue(mockAuthData);

    const request = createMockRequest({ token: specialToken });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockValidateAndSyncSession).toHaveBeenCalledWith(specialToken);
  });
});
