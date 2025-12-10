'use client';

import { useState } from 'react';
import { CitationPopover } from './CitationPopover';

interface Citation {
  response_id?: string;
  snippet: string;
}

interface InlineCitationProps {
  citations: Citation[];
  reportId: string;
  sectionType: string;
  sectionIndex: number;
  statementIndex?: number;
  auditModeEnabled: boolean;
}

/**
 * Inline numbered citation badges that appear after statement text.
 * Each number is clickable and shows the citation snippet in a popover.
 *
 * Example: "Statement text here. [1][2]"
 */
export function InlineCitation({
  citations,
  reportId,
  sectionType,
  sectionIndex,
  statementIndex = 0,
  auditModeEnabled,
}: InlineCitationProps) {
  const [activePopover, setActivePopover] = useState<number | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | undefined>();

  // Don't render if audit mode is off or no citations
  if (!auditModeEnabled || !citations || citations.length === 0) {
    return null;
  }

  const handleCitationClick = (index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering item selection
    event.preventDefault();
    setPopoverPosition({ x: event.clientX, y: event.clientY });
    setActivePopover(index);
  };

  return (
    <span className="inline-flex items-baseline gap-0.5 ml-1">
      {citations.map((citation, index) => (
        <button
          key={index}
          onClick={(e) => handleCitationClick(index, e)}
          className="text-xs text-primary-600 hover:text-primary-800 hover:bg-primary-100 rounded px-0.5 transition-colors font-medium"
          title={`View source ${index + 1}`}
        >
          [{index + 1}]
        </button>
      ))}

      {/* Show popover for the active citation */}
      {activePopover !== null && (
        <SingleCitationPopover
          citation={citations[activePopover]}
          citationNumber={activePopover + 1}
          totalCitations={citations.length}
          position={popoverPosition}
          onClose={() => setActivePopover(null)}
        />
      )}
    </span>
  );
}

/**
 * Simple popover that shows a single citation snippet directly
 * (no API call needed since we already have the data)
 */
interface SingleCitationPopoverProps {
  citation: Citation;
  citationNumber: number;
  totalCitations: number;
  position?: { x: number; y: number };
  onClose: () => void;
}

function SingleCitationPopover({
  citation,
  citationNumber,
  totalCitations,
  position,
  onClose,
}: SingleCitationPopoverProps) {
  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Calculate position
  const style = position
    ? {
        position: 'fixed' as const,
        left: Math.min(position.x, window.innerWidth - 350),
        top: Math.min(position.y + 10, window.innerHeight - 200),
      }
    : {
        position: 'fixed' as const,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        style={style}
        className="w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-600">
            Source {citationNumber} of {totalCitations}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ×
          </button>
        </div>

        {/* Citation content */}
        <div className="p-3">
          <div className="relative pl-3 border-l-2 border-primary-300">
            <p className="text-sm text-gray-700 italic leading-relaxed">
              "{citation.snippet}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InlineCitation;
