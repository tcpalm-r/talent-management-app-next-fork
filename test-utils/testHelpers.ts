/**
 * Test Utilities and Helpers
 *
 * Shared helper functions for writing tests across the codebase
 */

import type { UserProfile, SessionUser, Survey360, Survey360Response, Survey360Participant, Feedback360Question } from '@/lib/schema';

/**
 * Generate a mock UUID for testing
 */
export function mockUuid(prefix: string = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a mock date string
 */
export function mockDate(daysFromNow: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Wait for async operations (useful for testing)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock Supabase response
 */
export function mockSupabaseResponse<T>(data: T, error: any = null) {
  return {
    data,
    error,
    count: Array.isArray(data) ? data.length : null,
    status: error ? 500 : 200,
    statusText: error ? 'Error' : 'OK',
  };
}

/**
 * Create a mock Supabase query builder
 */
export function mockSupabaseQuery(response: any) {
  const chainable: any = {
    select: jest.fn().mockImplementation(() => chainable),
    insert: jest.fn().mockImplementation(() => chainable),
    update: jest.fn().mockImplementation(() => chainable),
    delete: jest.fn().mockImplementation(() => chainable),
    eq: jest.fn().mockImplementation(() => chainable),
    neq: jest.fn().mockImplementation(() => chainable),
    gt: jest.fn().mockImplementation(() => chainable),
    lt: jest.fn().mockImplementation(() => chainable),
    gte: jest.fn().mockImplementation(() => chainable),
    lte: jest.fn().mockImplementation(() => chainable),
    like: jest.fn().mockImplementation(() => chainable),
    ilike: jest.fn().mockImplementation(() => chainable),
    is: jest.fn().mockImplementation(() => chainable),
    in: jest.fn().mockImplementation(() => chainable),
    not: jest.fn().mockImplementation(() => chainable),
    order: jest.fn().mockImplementation(() => chainable),
    limit: jest.fn().mockImplementation(() => chainable),
    range: jest.fn().mockImplementation(() => chainable),
    single: jest.fn().mockResolvedValue(response),
    maybeSingle: jest.fn().mockResolvedValue(response),
  };

  // Make chainable thenable so await works
  chainable.then = (resolve: (value: any) => any, reject?: (reason: any) => any) =>
    Promise.resolve(response).then(resolve, reject);

  return chainable;
}

/**
 * Suppress console output during tests
 */
export function suppressConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });
}
