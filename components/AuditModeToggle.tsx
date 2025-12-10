'use client';

import { Eye, EyeOff } from 'lucide-react';

interface AuditModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  /** Is the current user an admin? */
  isAdmin?: boolean;
}

/**
 * Toggle button for enabling/disabling audit mode in 360 reports.
 * When enabled, report statements show inline citation badges.
 *
 * ADMIN-ONLY FEATURE:
 * - Only admins see this component
 * - Sponsors and subjects never see citations
 * - Citations are now always generated with reports (no validation step needed)
 */
export function AuditModeToggle({
  enabled,
  onToggle,
  disabled = false,
  isAdmin = false,
}: AuditModeToggleProps) {
  // Only show to admins
  if (!isAdmin) {
    return null;
  }

  // Show audit mode toggle
  return (
    <button
      onClick={() => onToggle(!enabled)}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
        transition-all duration-200 ease-in-out
        ${enabled
          ? 'bg-primary-100 text-primary-700 border border-primary-300 hover:bg-primary-200'
          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={enabled ? 'Exit audit mode' : 'Enter audit mode to see source citations'}
    >
      {enabled ? (
        <>
          <Eye className="w-4 h-4" />
          <span>Audit Mode</span>
          <span className="text-xs bg-primary-200 px-1.5 py-0.5 rounded">ON</span>
        </>
      ) : (
        <>
          <EyeOff className="w-4 h-4" />
          <span>Audit Mode</span>
        </>
      )}
    </button>
  );
}

export default AuditModeToggle;
