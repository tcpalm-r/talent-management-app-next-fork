/**
 * Authentication - Supabase Integration
 *
 * Synchronizes authenticated users with Supabase user_profiles table.
 * Creates or updates user profiles based on AI Intranet authentication.
 */

import { supabaseAdmin } from './supabase-admin';
import type { SessionUser, UserProfile } from './schema';

// ============================================================================
// USER PROFILE SYNCHRONIZATION
// ============================================================================

/**
 * Sync authenticated user to Supabase user_profiles table
 * Creates profile if it doesn't exist, updates if it does
 */
export async function syncUserProfile(sessionUser: SessionUser): Promise<UserProfile | null> {
  try {
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', sessionUser.email)
      .single();

    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          full_name: sessionUser.full_name,
          app_role: sessionUser.app_role,
          app_permissions: sessionUser.app_permissions || {},
          department: sessionUser.department || null,
          title: sessionUser.title || null,
          has_logged_in: true,
          last_login_at: now,
          updated_at: now,
        })
        .eq('email', sessionUser.email)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user profile:', updateError);
        return null;
      }

      return updatedUser as UserProfile;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: sessionUser.id,
          email: sessionUser.email,
          full_name: sessionUser.full_name,
          app_role: sessionUser.app_role || 'user',
          app_permissions: sessionUser.app_permissions || {},
          app_access: true,
          department: sessionUser.department || null,
          title: sessionUser.title || null,
          has_logged_in: true,
          first_login_at: now,
          last_login_at: now,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        return null;
      }

      return newUser as UserProfile;
    }
  } catch (error) {
    console.error('Error syncing user profile:', error);
    return null;
  }
}

/**
 * Get user profile from Supabase by email
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Get user profile from Supabase by ID
 */
export async function getUserProfileById(id: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Convert UserProfile to SessionUser
 */
export function toSessionUser(profile: UserProfile): SessionUser {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    app_role: profile.app_role || 'user',
    app_permissions: (profile.app_permissions as Record<string, any>) || {},
    department: profile.department,
    title: profile.title,
  };
}

/**
 * Check if user has app access
 */
export async function hasAppAccess(email: string): Promise<boolean> {
  try {
    const profile = await getUserProfileByEmail(email);
    return profile?.app_access === true && profile?.is_active === true;
  } catch {
    return false;
  }
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(email: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('user_profiles')
      .update({
        last_login_at: now,
        has_logged_in: true,
      })
      .eq('email', email);
  } catch (error) {
    console.error('Error updating last login:', error);
  }
}

// ============================================================================
// USER PERMISSIONS
// ============================================================================

/**
 * Check if user has specific permission
 */
export async function checkPermission(
  email: string,
  permission: string
): Promise<boolean> {
  try {
    const profile = await getUserProfileByEmail(email);
    if (!profile) return false;

    // Admins have all permissions
    if (profile.app_role === 'admin') return true;

    // Check specific permission
    const permissions = profile.app_permissions as Record<string, any>;
    return permissions?.[permission] === true;
  } catch {
    return false;
  }
}

/**
 * Check if user has any of the specified roles
 */
export async function checkRole(email: string, ...roles: string[]): Promise<boolean> {
  try {
    const profile = await getUserProfileByEmail(email);
    if (!profile) return false;

    return roles.includes(profile.app_role || 'user');
  } catch {
    return false;
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Sync multiple users at once (for batch imports)
 */
export async function syncMultipleUsers(
  users: SessionUser[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const user of users) {
    const result = await syncUserProfile(user);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Sync user profile using Supabase client - with auth0_id support
 * This is the main sync function used by middleware for Sonance hub authentication
 */
export async function syncUserProfileViaSupabase(userData: any): Promise<any> {
  try {
    console.log('[SYNC-SUPABASE] Starting profile sync for:', userData.email);

    if (!userData?.auth0_id || !userData?.email) {
      console.error('[SYNC-SUPABASE] Missing auth0_id or email; cannot sync profile');
      return null;
    }

    // Preserve roles/permissions from the local database (source of truth)
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, app_role, app_permissions, global_role, capabilities, app_access, local_permissions')
      .eq('auth0_id', userData.auth0_id)
      .maybeSingle();

    // Prepare the profile data
    const profileData = {
      id: existingProfile?.id || userData.id,
      auth0_id: userData.auth0_id,
      email: userData.email,
      full_name: userData.full_name || userData.email,
      given_name: userData.given_name || null,
      family_name: userData.family_name || null,
      picture: userData.picture || userData.avatar_url || null,
      avatar_url: userData.avatar_url || userData.picture || null,
      global_role: existingProfile?.global_role || 'user',
      capabilities: existingProfile?.capabilities || [],
      app_role: existingProfile?.app_role || 'user',
      app_permissions: existingProfile?.app_permissions || {},
      app_access: existingProfile?.app_access ?? true,
      local_permissions: existingProfile?.local_permissions || {},
      department: userData.department || null,
      title: userData.title || null,
      phone: userData.phone || null,
      location: userData.location || null,
      last_sync: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString()
    };

    console.log('[SYNC-SUPABASE] Profile data prepared:', {
      email: profileData.email,
      app_role: profileData.app_role,
      app_access: profileData.app_access
    });

    // Upsert the user profile using Supabase admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profileData, {
        onConflict: 'auth0_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[SYNC-SUPABASE] Failed to sync profile:', error);

      // If upsert fails, try insert then update
      if (error.code === '23505') { // Duplicate key error
        console.log('[SYNC-SUPABASE] Attempting update instead of insert...');

        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            ...profileData,
            created_at: undefined // Don't update created_at on update
          })
          .eq('auth0_id', userData.auth0_id)
          .select()
          .single();

        if (updateError) {
          console.error('[SYNC-SUPABASE] Update also failed:', updateError);
          throw updateError;
        }

        console.log('[SYNC-SUPABASE] Profile updated successfully:', updateData?.email);
        return updateData;
      }

      throw error;
    }

    console.log('[SYNC-SUPABASE] Profile synced successfully:', data?.email);
    return data;
  } catch (error) {
    console.error('[SYNC-SUPABASE] Sync failed with error:', error);

    // Return null instead of throwing to avoid breaking authentication
    // User can still use the app even if profile sync fails
    return null;
  }
}

/**
 * Get all active users from Supabase
 */
export async function getAllActiveUsers(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('is_active', true)
      .eq('app_access', true)
      .order('full_name');

    if (error) {
      console.error('Error fetching active users:', error);
      return [];
    }

    return (data as UserProfile[]) || [];
  } catch (error) {
    console.error('Error fetching active users:', error);
    return [];
  }
}
