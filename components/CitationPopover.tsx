'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Quote, Loader2 } from 'lucide-react';

interface Citation {
  id: string;
  snippet: string;
  section_type: string;
  section_index: number;
  statement_index: number;
}

interface CitationPopoverProps {
  reportId: string;
  sectionType: string;
  sectionIndex: number;
  statementIndex?: number;
  onClose: () => void;
  position?: { x: number; y: number };
}

/**
 * Popover that displays source citations when a statement is clicked in audit mode.
 * Shows anonymized snippets from the original survey responses.
 */
export function CitationPopover({
  reportId,
  sectionType,
  sectionIndex,
  statementIndex = 0,
  onClose,
  position,
}: CitationPopoverProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch citations when popover opens
  useEffect(() => {
    const fetchCitations = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/360-citations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_id: reportId,
            section_type: sectionType,
            section_index: sectionIndex,
            statement_index: statementIndex,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch citations');
        }

        const data = await response.json();
        setCitations(data.citations || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCitations();
  }, [reportId, sectionType, sectionIndex, statementIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Calculate position (centered on screen if no position provided)
  const style = position
    ? {
        position: 'fixed' as const,
        left: Math.min(position.x, window.innerWidth - 400),
        top: Math.min(position.y + 10, window.innerHeight - 300),
      }
    : {
        position: 'fixed' as const,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <div
      ref={popoverRef}
      style={style}
      className="z-50 w-96 max-h-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Quote className="w-4 h-4 text-primary-500" />
          <span>Source Citations</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-60 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading citations...</span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {error}
          </div>
        )}

        {!loading && !error && citations.length === 0 && (
          <div className="text-sm text-gray-500 italic">
            No citations found for this statement.
          </div>
        )}

        {!loading && !error && citations.length > 0 && (
          <div className="space-y-3">
            {citations.map((citation, index) => (
              <div
                key={citation.id}
                className="relative pl-4 border-l-2 border-primary-300"
              >
                <p className="text-sm text-gray-700 italic leading-relaxed">
                  "{citation.snippet}"
                </p>
                {citations.length > 1 && (
                  <span className="absolute -left-2 top-0 w-4 h-4 bg-primary-100 rounded-full flex items-center justify-center text-xs text-primary-600">
                    {index + 1}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && citations.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
          {citations.length} source{citations.length !== 1 ? 's' : ''} found
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper component that makes text clickable in audit mode
 */
interface AuditableStatementProps {
  children: React.ReactNode;
  reportId: string;
  sectionType: string;
  sectionIndex: number;
  statementIndex?: number;
  auditModeEnabled: boolean;
}

export function AuditableStatement({
  children,
  reportId,
  sectionType,
  sectionIndex,
  statementIndex = 0,
  auditModeEnabled,
}: AuditableStatementProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | undefined>();

  const handleClick = (event: React.MouseEvent) => {
    if (!auditModeEnabled) return;

    event.stopPropagation();
    setPopoverPosition({ x: event.clientX, y: event.clientY });
    setShowPopover(true);
  };

  if (!auditModeEnabled) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        onClick={handleClick}
        className="cursor-pointer hover:bg-primary-50 hover:underline decoration-primary-300 decoration-dotted underline-offset-2 transition-colors rounded px-0.5 -mx-0.5"
        title="Click to view source citations"
      >
        {children}
      </span>

      {showPopover && (
        <CitationPopover
          reportId={reportId}
          sectionType={sectionType}
          sectionIndex={sectionIndex}
          statementIndex={statementIndex}
          position={popoverPosition}
          onClose={() => setShowPopover(false)}
        />
      )}
    </>
  );
}

export default CitationPopover;
