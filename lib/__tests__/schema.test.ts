/**
 * Tests for schema.ts - Type Guards and Helper Functions
 */

import { isAdmin, isLeader } from '../schema';
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

    it('should be case-sensitive for app_role', () => {
      // TypeScript should prevent this, but test runtime behavior
      const userWithWeirdRole = createMockUserProfile({ app_role: 'Admin' as any });

      expect(isAdmin(userWithWeirdRole)).toBe(false); // 'Admin' !== 'admin'
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
});
