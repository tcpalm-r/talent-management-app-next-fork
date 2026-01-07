/**
 * User Sync Utilities
 *
 * Syncs user profiles from Project A (central user directory) to this app's database.
 *
 * IMPORTANT: This does SELECTIVE COLUMN SYNC - only Project A columns are synced.
 * App-specific columns (app_role, app_access, etc.) are left untouched.
 *
 * - On-login sync: Syncs individual user when they log in
 * - Scheduled sync: Syncs all users daily
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';

// ============================================================================
// PROJECT A CLIENT (Remote - Central User Directory)
// ============================================================================

const projectAUrl = process.env.NEXT_PUBLIC_PROJECT_A_URL;
const projectAKey = process.env.NEXT_PUBLIC_PROJECT_A_ANON_KEY;

if (!projectAUrl || !projectAKey) {
  console.warn('[SYNC] Project A credentials not configured. User sync will be disabled.');
}

const projectAClient = projectAUrl && projectAKey
  ? createClient(projectAUrl, projectAKey)
  : null;

// ============================================================================
// COLUMNS TO SYNC FROM PROJECT A
// ============================================================================

/**
 * Only these columns are synced from Project A.
 * This list only includes columns that exist in BOTH Project A and the local database.
 * App-specific columns (app_role, app_access, app_permissions, has_logged_in, etc.)
 * are NOT in this list and will be left untouched during sync.
 */
const PROJECT_A_COLUMNS = [
  'id',
  'auth0_id',
  'email',
  'full_name',
  'given_name',
  'family_name',
  'picture',
  'avatar_url',
  'capabilities',
  'department',
  'job_title',
  'location',
  'manager_id',
  'manager_email',
  'employee_number',
  'cost_center',
  'external_id',
  'scim_active',
  // Note: These columns exist in Project A but NOT in local database:
  // role, phone_number, scim_metadata, is_active, auth_provider, auth0_verified,
  // auth0_user_id, login_count, last_login_provider, last_sign_in_at, sso_metadata, email_verified
] as const;

// ============================================================================
// TYPES
// ============================================================================

export interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
  errors?: string[];
}

export interface ProjectAUserProfile {
  id: string;
  auth0_id: string | null;
  email: string;
  full_name: string;
  given_name: string | null;
  family_name: string | null;
  picture: string | null;
  avatar_url: string | null;
  capabilities: any;
  department: string | null;
  job_title: string | null;
  location: string | null;
  manager_id: string | null;
  manager_email: string | null;
  employee_number: string | null;
  cost_center: string | null;
  external_id: string | null;
  scim_active: boolean | null;
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Sync a single user from Project A by email
 * Call this when a user logs in
 */
export async function syncUserFromProjectA(email: string): Promise<SyncResult> {
  if (!projectAClient) {
    return {
      success: false,
      message: 'Project A client not configured',
    };
  }

  try {
    console.log(`[SYNC] Syncing user from Project A: ${email}`);

    // Fetch user from Project A (only the columns we need)
    const { data: remoteUser, error: fetchError } = await projectAClient
      .from('user_profiles')
      .select(PROJECT_A_COLUMNS.join(','))
      .eq('email', email)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // User not found in Project A
        console.log(`[SYNC] User not found in Project A: ${email}`);
        return {
          success: false,
          message: `User not found in Project A: ${email}`,
        };
      }
      throw fetchError;
    }

    // Transform to local schema
    const localProfile = transformProjectAUser(remoteUser as ProjectAUserProfile);

    // Upsert to local user_profiles (only Project A columns are updated)
    // Use email as conflict key since IDs may differ between systems
    const { error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(localProfile, {
        onConflict: 'email',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw upsertError;
    }

    console.log(`[SYNC] Successfully synced user: ${email}`);
    return {
      success: true,
      message: `Synced user: ${email}`,
      count: 1,
    };
  } catch (error) {
    console.error('[SYNC] Error syncing user:', error);
    return {
      success: false,
      message: `Error syncing user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Sync all users from Project A
 * Call this from scheduled job (daily)
 */
export async function syncAllUsersFromProjectA(): Promise<SyncResult> {
  if (!projectAClient) {
    return {
      success: false,
      message: 'Project A client not configured',
    };
  }

  try {
    console.log('[SYNC] Starting full user sync from Project A...');

    // Fetch all users from Project A (only the columns we need)
    const { data: remoteUsers, error: fetchError } = await projectAClient
      .from('user_profiles')
      .select(PROJECT_A_COLUMNS.join(','));

    if (fetchError) {
      throw fetchError;
    }

    if (!remoteUsers || remoteUsers.length === 0) {
      return {
        success: true,
        message: 'No users found in Project A',
        count: 0,
      };
    }

    console.log(`[SYNC] Found ${remoteUsers.length} users in Project A`);

    // Transform all users
    const localProfiles = remoteUsers.map((user) =>
      transformProjectAUser(user as ProjectAUserProfile)
    );

    // Batch upsert to local user_profiles
    // Only Project A columns are updated, app-specific columns remain untouched
    // Use email as conflict key since IDs may differ between systems
    const { error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(localProfiles, {
        onConflict: 'email',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw upsertError;
    }

    console.log(`[SYNC] Successfully synced ${remoteUsers.length} users`);
    return {
      success: true,
      message: `Synced ${remoteUsers.length} users from Project A`,
      count: remoteUsers.length,
    };
  } catch (error) {
    console.error('[SYNC] Error syncing all users:', error);
    return {
      success: false,
      message: `Error syncing users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Sync a single user by ID from Project A
 */
export async function syncUserByIdFromProjectA(userId: string): Promise<SyncResult> {
  if (!projectAClient) {
    return {
      success: false,
      message: 'Project A client not configured',
    };
  }

  try {
    console.log(`[SYNC] Syncing user by ID from Project A: ${userId}`);

    // Fetch user from Project A
    const { data: remoteUser, error: fetchError } = await projectAClient
      .from('user_profiles')
      .select(PROJECT_A_COLUMNS.join(','))
      .eq('id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return {
          success: false,
          message: `User not found in Project A: ${userId}`,
        };
      }
      throw fetchError;
    }

    // Transform and upsert
    // Use email as conflict key since IDs may differ between systems
    const localProfile = transformProjectAUser(remoteUser as ProjectAUserProfile);

    const { error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(localProfile, {
        onConflict: 'email',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw upsertError;
    }

    console.log(`[SYNC] Successfully synced user: ${userId}`);
    return {
      success: true,
      message: `Synced user: ${userId}`,
      count: 1,
    };
  } catch (error) {
    console.error('[SYNC] Error syncing user by ID:', error);
    return {
      success: false,
      message: `Error syncing user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transform Project A user to local user_profiles schema
 * Only includes fields that exist in BOTH Project A and local database.
 * App-specific fields (app_role, app_access, etc.) are NOT included
 * so they won't be overwritten during upsert.
 */
function transformProjectAUser(remote: ProjectAUserProfile): Record<string, any> {
  return {
    // Note: NOT including 'id' - we match on email and keep local IDs
    // This avoids foreign key conflicts when IDs differ between systems
    auth0_id: remote.auth0_id,
    email: remote.email,
    full_name: remote.full_name,
    given_name: remote.given_name,
    family_name: remote.family_name,
    picture: remote.picture,
    avatar_url: remote.avatar_url,
    capabilities: remote.capabilities,
    department: remote.department,
    title: remote.job_title, // Map job_title to title for local compatibility
    job_title: remote.job_title,
    location: remote.location,
    manager_id: remote.manager_id,
    manager_email: remote.manager_email,
    employee_number: remote.employee_number,
    cost_center: remote.cost_center,
    external_id: remote.external_id,
    scim_active: remote.scim_active,
    // Note: NOT including columns that don't exist in local DB:
    // role, phone_number, scim_metadata, is_active, auth_provider, etc.
    // Also NOT including app-specific columns: app_role, app_access, etc.
  };
}

/**
 * Check if Project A sync is configured
 */
export function isProjectASyncConfigured(): boolean {
  return projectAClient !== null;
}

/**
 * Get Project A URL (for debugging)
 */
export function getProjectAUrl(): string | undefined {
  return projectAUrl;
}
