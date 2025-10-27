/**
 * Drizzle ORM Database Client
 *
 * This file sets up Drizzle ORM to work with your existing Supabase database.
 * It DOES NOT create or modify any database structure - it only provides
 * a typed query interface for your existing tables.
 *
 * SAFETY: This file only creates database CLIENT instances.
 * No schema creation, no migrations, no table modifications.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

/**
 * Get Supabase connection URL from environment
 * Uses the existing Supabase project - NO new database creation
 */
function getConnectionString(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }

  // Extract the project ID from the Supabase URL
  // Format: https://[PROJECT_ID].supabase.co
  const projectId = supabaseUrl.replace('https://', '').split('.')[0];

  // For server-side operations, use direct postgres connection
  // This connects to your EXISTING Supabase database
  if (supabaseKey) {
    // Use connection pooler for better performance
    return `postgresql://postgres.${projectId}:${supabaseKey}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
  }

  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for database operations');
}

// ============================================================================
// POSTGRES CLIENT INSTANCES
// ============================================================================

/**
 * Create a postgres client for querying
 * This connects to your EXISTING Supabase database
 */
let queryClient: ReturnType<typeof postgres> | null = null;

export function getQueryClient() {
  if (!queryClient) {
    const connectionString = getConnectionString();
    queryClient = postgres(connectionString, {
      prepare: false, // Required for connection pooler
      max: 10, // Maximum connections in pool
    });
  }
  return queryClient;
}

/**
 * Create a postgres client for transactions
 * Separate client to avoid connection conflicts
 */
let transactionClient: ReturnType<typeof postgres> | null = null;

export function getTransactionClient() {
  if (!transactionClient) {
    const connectionString = getConnectionString();
    transactionClient = postgres(connectionString, {
      prepare: false,
      max: 5,
    });
  }
  return transactionClient;
}

// ============================================================================
// DRIZZLE ORM INSTANCES
// ============================================================================

/**
 * Main Drizzle database instance
 * Use this for standard queries
 *
 * Example usage:
 * ```typescript
 * import { db } from '@/lib/db';
 * const users = await db.select().from(userProfiles).limit(10);
 * ```
 */
export const db = drizzle(getQueryClient(), {
  logger: process.env.NODE_ENV === 'development',
});

/**
 * Transaction-specific Drizzle instance
 * Use this when you need transaction support
 */
export const txDb = drizzle(getTransactionClient(), {
  logger: process.env.NODE_ENV === 'development',
});

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Execute a function within a database transaction
 * All queries within the callback are executed atomically
 *
 * Example usage:
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   await tx.insert(users).values({ email: 'test@example.com' });
 *   await tx.insert(profiles).values({ userId: 1 });
 *   return { success: true };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  const client = getTransactionClient();

  try {
    const result = await client.begin(async (sql) => {
      const txDb = drizzle(sql as any);
      return await callback(txDb);
    });
    return result;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Execute a raw SQL query safely
 * Use this for complex queries not easily expressed with Drizzle
 *
 * Example usage:
 * ```typescript
 * const results = await executeRawQuery<UserProfile>(
 *   'SELECT * FROM user_profiles WHERE email = $1',
 *   ['test@example.com']
 * );
 * ```
 */
export async function executeRawQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const client = getQueryClient();
  try {
    const result = await client.unsafe(query, params);
    return result as T[];
  } catch (error) {
    console.error('Raw query failed:', error);
    throw error;
  }
}

/**
 * Execute a raw SQL query and return a single result
 */
export async function executeRawQueryOne<T = any>(
  query: string,
  params: any[] = []
): Promise<T | null> {
  const results = await executeRawQuery<T>(query, params);
  return results[0] ?? null;
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Close all database connections
 * Call this when shutting down the application
 */
export async function closeConnections() {
  if (queryClient) {
    await queryClient.end();
    queryClient = null;
  }
  if (transactionClient) {
    await transactionClient.end();
    transactionClient = null;
  }
}

/**
 * Test database connection
 * Use this to verify the database is accessible
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = getQueryClient();
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Type for the database instance
 * Use this for type annotations
 */
export type Database = typeof db;

/**
 * Type for transaction context
 */
export type TransactionContext = typeof db;
