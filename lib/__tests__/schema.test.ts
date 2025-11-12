/**
 * Tests for schema.ts - Type Guards and Helper Functions
 */

import { isAdmin, isLeader, hasPermission } from '../schema';
import { mockUserProfiles, mockSessionUsers, createMockUserProfile, createMockSessionUser } from '../../test-utils/mockData';

describe('schema.ts - Type Guards', () => {
  describe('isAdmin', () => {
    it('should return true for admin user profile', () => {
      const admin = mockUserProfiles.admin;
      expect(isAdmin(admin)).toBe(true);
    });

    it('should return true for admin session user', () => {
      const admin = mockSessionUsers.admin;
      expect(isAdmin(admin)).toBe(true);
    });

    it('should return false for leader user', () => {
      const leader = mockUserProfiles.leader;
      expect(isAdmin(leader)).toBe(false);
    });

    it('should return false for regular user', () => {
      const user = mockUserProfiles.user;
      expect(isAdmin(user)).toBe(false);
    });

    it('should handle user with null app_role', () => {
      const userWithNullRole = createMockUserProfile({ app_role: null });
      expect(isAdmin(userWithNullRole)).toBe(false);
    });
  });

  describe('isLeader', () => {
    it('should return true for leader user', () => {
      const leader = mockUserProfiles.leader;
      expect(isLeader(leader)).toBe(true);
    });

    it('should return true for admin user (admins are also leaders)', () => {
      const admin = mockUserProfiles.admin;
      expect(isLeader(admin)).toBe(true);
    });

    it('should return false for regular user', () => {
      const user = mockUserProfiles.user;
      expect(isLeader(user)).toBe(false);
    });

    it('should handle session user correctly', () => {
      expect(isLeader(mockSessionUsers.admin)).toBe(true);
      expect(isLeader(mockSessionUsers.leader)).toBe(true);
      expect(isLeader(mockSessionUsers.user)).toBe(false);
    });

    it('should handle user with null app_role', () => {
      const userWithNullRole = createMockUserProfile({ app_role: null });
      expect(isLeader(userWithNullRole)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has the specific permission', () => {
      const admin = mockUserProfiles.admin;
      expect(hasPermission(admin, 'manage_users')).toBe(true);
      expect(hasPermission(admin, 'manage_reviews')).toBe(true);
    });

    it('should return false when user lacks the permission', () => {
      const user = mockUserProfiles.user;
      expect(hasPermission(user, 'manage_users')).toBe(false);
    });

    it('should handle session user correctly', () => {
      const leader = mockSessionUsers.leader;
      expect(hasPermission(leader, 'manage_surveys')).toBe(true);
      expect(hasPermission(leader, 'view_analytics')).toBe(true);
      expect(hasPermission(leader, 'manage_users')).toBe(false);
    });

    it('should return false when user has null app_permissions', () => {
      const userWithoutPerms = createMockUserProfile({ app_permissions: null });
      expect(hasPermission(userWithoutPerms, 'any_permission')).toBe(false);
    });

    it('should return false when permission is explicitly false', () => {
      const user = createMockUserProfile({
        app_permissions: {
          manage_users: false,
        },
      });
      expect(hasPermission(user, 'manage_users')).toBe(false);
    });

    it('should return false when permission key does not exist', () => {
      const admin = mockUserProfiles.admin;
      expect(hasPermission(admin, 'nonexistent_permission')).toBe(false);
    });

    it('should handle empty app_permissions object', () => {
      const user = createMockUserProfile({ app_permissions: {} });
      expect(hasPermission(user, 'any_permission')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle users with various role combinations', () => {
      const customUser1 = createMockUserProfile({ app_role: 'admin' });
      const customUser2 = createMockUserProfile({ app_role: 'leader' });
      const customUser3 = createMockUserProfile({ app_role: 'user' });

      expect(isAdmin(customUser1)).toBe(true);
      expect(isAdmin(customUser2)).toBe(false);
      expect(isAdmin(customUser3)).toBe(false);

      expect(isLeader(customUser1)).toBe(true);
      expect(isLeader(customUser2)).toBe(true);
      expect(isLeader(customUser3)).toBe(false);
    });

    it('should handle session users with various permission sets', () => {
      const noPerms = createMockSessionUser({ app_permissions: {} });
      const somePerms = createMockSessionUser({
        app_permissions: {
          view_analytics: true,
          manage_surveys: false,
        },
      });
      const allPerms = createMockSessionUser({
        app_permissions: {
          manage_users: true,
          manage_reviews: true,
          manage_surveys: true,
          view_analytics: true,
        },
      });

      expect(hasPermission(noPerms, 'view_analytics')).toBe(false);
      expect(hasPermission(somePerms, 'view_analytics')).toBe(true);
      expect(hasPermission(somePerms, 'manage_surveys')).toBe(false);
      expect(hasPermission(allPerms, 'manage_users')).toBe(true);
    });

    it('should be case-sensitive for app_role', () => {
      // TypeScript should prevent this, but test runtime behavior
      const userWithWeirdRole = createMockUserProfile({ app_role: 'Admin' as any });

      expect(isAdmin(userWithWeirdRole)).toBe(false); // 'Admin' !== 'admin'
    });

    it('should be case-sensitive for permission names', () => {
      const admin = mockUserProfiles.admin;

      // Assuming permissions are case-sensitive
      expect(hasPermission(admin, 'manage_users')).toBe(true);
      expect(hasPermission(admin, 'MANAGE_USERS')).toBe(false);
    });
  });
});

describe('schema.ts - Type Consistency', () => {
  it('should maintain consistent role values', () => {
    // Verify that our mock data uses valid role types
    expect(['admin', 'leader', 'user']).toContain(mockUserProfiles.admin.app_role);
    expect(['admin', 'leader', 'user']).toContain(mockUserProfiles.leader.app_role);
    expect(['admin', 'leader', 'user']).toContain(mockUserProfiles.user.app_role);
  });

  it('should maintain consistent permission keys', () => {
    const admin = mockUserProfiles.admin;
    const leader = mockUserProfiles.leader;

    // Verify common permission keys exist
    expect(admin.app_permissions).toHaveProperty('manage_users');
    expect(admin.app_permissions).toHaveProperty('manage_reviews');
    expect(admin.app_permissions).toHaveProperty('manage_surveys');
    expect(admin.app_permissions).toHaveProperty('view_analytics');

    expect(leader.app_permissions).toHaveProperty('manage_surveys');
    expect(leader.app_permissions).toHaveProperty('view_analytics');
  });
});
