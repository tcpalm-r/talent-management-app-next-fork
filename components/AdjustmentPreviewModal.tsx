'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Check, ArrowRight, Loader2, Info } from 'lucide-react';

interface AdjustmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  originalText: string;
  adjustedText: string | null;
  isLoading: boolean;
  adjustmentType: 'specificity' | 'tone' | 'length';
  direction: string;
  sectionType: string;
}

export default function AdjustmentPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  originalText,
  adjustedText,
  isLoading,
  adjustmentType,
  direction,
  sectionType,
}: AdjustmentPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Check if the adjusted text is essentially unchanged from the original
  const isUnchanged = useMemo(() => {
    if (!adjustedText || isLoading) return false;
    // Normalize both texts for comparison (trim, collapse whitespace)
    const normalizeText = (text: string) =>
      text.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalizeText(originalText) === normalizeText(adjustedText);
  }, [originalText, adjustedText, isLoading]);

  if (!isOpen) return null;

  const getAdjustmentLabel = () => {
    const labels: Record<string, Record<string, string>> = {
      specificity: { more: 'More Specific', less: 'Less Specific' },
      tone: { harsher: 'Harsher Tone', softer: 'Softer Tone' },
      length: { longer: 'Longer', shorter: 'Shorter' },
    };
    return labels[adjustmentType]?.[direction] || direction;
  };

  const getSectionLabel = () => {
    const labels: Record<string, string> = {
      themes: 'Theme',
      strengths: 'Strength',
      development_areas: 'Development Area',
      key_insights: 'Key Insight',
    };
    return labels[sectionType] || sectionType;
  };

  // Format text for display - handle both string and theme object
  const formatDisplayText = (text: string) => {
    if (!text) return '';
    // If it's bullet points (newline separated), format as list
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length > 1) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {lines.map((line, idx) => (
            <li key={idx} className="text-sm">{line.trim()}</li>
          ))}
        </ul>
      );
    }
    return <p className="text-sm">{text}</p>;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Preview Adjustment
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {getSectionLabel()} &rarr; {getAdjustmentLabel()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Original
                </span>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[120px]">
                <div className="text-gray-700 dark:text-gray-300">
                  {formatDisplayText(originalText)}
                </div>
              </div>
            </div>

            {/* Arrow for desktop */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
              <ArrowRight className="w-6 h-6 text-blue-500" />
            </div>

            {/* Adjusted */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  Adjusted
                </span>
                {isLoading && (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                )}
              </div>
              <div className={`p-4 rounded-lg border min-h-[120px] transition-colors ${
                isLoading
                  ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                  : isUnchanged
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}>
                {isLoading ? (
                  <div className="flex items-center justify-center h-full min-h-[80px]">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Generating preview...
                      </span>
                    </div>
                  </div>
                ) : adjustedText ? (
                  <div className="text-gray-700 dark:text-gray-300">
                    {formatDisplayText(adjustedText)}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[80px]">
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      Preview will appear here
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Unchanged notification */}
          {isUnchanged && !isLoading && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-medium">No changes made.</span>{' '}
                The AI determined that making this adjustment would change the meaning or sentiment of the original feedback, so it returned the text unchanged. This preserves the integrity of the reviewer&apos;s observations.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              {isUnchanged ? 'Close' : 'Cancel'}
            </button>
            {!isUnchanged && (
              <button
                onClick={onConfirm}
                disabled={isLoading || !adjustedText}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Apply Change
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
