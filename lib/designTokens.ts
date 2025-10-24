/**
 * Design Tokens - Unified Design System
 * Single source of truth for spacing, colors, shadows, and typography
 */

export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  '3xl': '3rem',    // 48px
  '4xl': '4rem',    // 64px
} as const;

export const borderRadius = {
  sm: '0.5rem',     // 8px - small elements, badges
  md: '0.75rem',    // 12px - cards, buttons
  lg: '1rem',       // 16px - larger cards
  xl: '1.5rem',     // 24px - modals, major sections
  full: '9999px',   // pills, avatars
} as const;

export const shadows = {
  none: 'none',
  card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  elevated: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  modal: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

export const colors = {
  // Primary brand
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Semantic colors
  success: {
    light: '#dcfce7',
    DEFAULT: '#22c55e',
    dark: '#16a34a',
  },
  warning: {
    light: '#fef3c7',
    DEFAULT: '#f59e0b',
    dark: '#d97706',
  },
  error: {
    light: '#fee2e2',
    DEFAULT: '#ef4444',
    dark: '#dc2626',
  },
  info: {
    light: '#dbeafe',
    DEFAULT: '#3b82f6',
    dark: '#2563eb',
  },

  // Neutral grays
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: 'system-ui, -apple-system, sans-serif',
  },
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// Badge variants
export const badgeStyles = {
  solid: {
    blue: 'bg-blue-100 text-blue-800 border border-blue-200',
    green: 'bg-green-100 text-green-800 border border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    red: 'bg-red-100 text-red-800 border border-red-200',
    purple: 'bg-purple-100 text-purple-800 border border-purple-200',
    gray: 'bg-gray-100 text-gray-800 border border-gray-200',
  },
} as const;

// Button variants
export const buttonStyles = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200',
  success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
} as const;

// Stat card styling
export const statCardStyle = 'bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow';

// Standard card styling
export const cardStyle = 'bg-white border border-gray-200 rounded-lg shadow-card';

// ============================================================================
// MATRIX ORGANIZATION COLORS
// ============================================================================

export const matrixColors = {
  // Relationship types
  primary: '#2563eb',      // Blue - solid line (primary reporting)
  matrix: '#94a3b8',       // Gray - dotted line (matrix reporting)

  // Brands
  iport: '#8b5cf6',        // Purple
  sonance: '#10b981',      // Green
  james: '#f59e0b',        // Amber
  blaze: '#ef4444',        // Red
  truefig: '#3b82f6',      // Blue

  // Sales Channels
  residential: '#ec4899',   // Pink (Bugry Residential)
  retail: '#06b6d4',       // Cyan
  commercial: '#8b5cf6',   // Purple (Commercial Audio)
  enterprise: '#6366f1',   // Indigo (iPort Enterprise)
} as const;

// Org chart line styles
export const orgChartLineStyles = {
  primary: {
    stroke: matrixColors.primary,
    strokeWidth: 3,
    strokeDasharray: '0',
    opacity: 1,
  },
  matrix: {
    stroke: matrixColors.matrix,
    strokeWidth: 2,
    strokeDasharray: '5, 5',
    opacity: 0.7,
  },
} as const;

// Org chart node styles
export const orgChartNodeStyle = 'bg-white border-2 border-gray-200 rounded-lg shadow-card hover:shadow-elevated transition-all';
