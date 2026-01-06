'use client';

/**
 * useTeams Hook
 *
 * Re-exports the useTeams hook from TeamsContext for convenient imports.
 *
 * Usage:
 * ```tsx
 * import { useTeams } from '@/hooks/useTeams';
 *
 * function MyComponent() {
 *   const { isInTeams, theme, getTeamsToken } = useTeams();
 *   // ...
 * }
 * ```
 */
export { useTeams } from '@/context/TeamsContext';
