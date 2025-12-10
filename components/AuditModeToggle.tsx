'use client';

import { Eye, EyeOff } from 'lucide-react';

interface AuditModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  hasCitations?: boolean;
}

/**
 * Toggle button for enabling/disabling audit mode in 360 reports.
 * When enabled, report statements become clickable to reveal source citations.
 *
 * Only shown to sponsors and admins (never to subjects).
 */
export function AuditModeToggle({
  enabled,
  onToggle,
  disabled = false,
  hasCitations = true,
}: AuditModeToggleProps) {
  if (!hasCitations) {
    // Don't show toggle if report has no citations
    return null;
  }

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
