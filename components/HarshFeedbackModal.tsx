'use client';

import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import type { HarshFeedbackResult, HarshFinding } from '@/lib/prompts/identify-harsh-feedback';

interface HarshFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: HarshFeedbackResult | null;
  employeeName: string;
}

const formatRelationship = (relationship: string): string => {
  return relationship
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

const severityColors: Record<HarshFinding['severity'], string> = {
  mild: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  moderate: 'bg-orange-50 border-orange-300 text-orange-800',
  harsh: 'bg-red-50 border-red-300 text-red-800',
};

const severityIcons: Record<HarshFinding['severity'], typeof Info> = {
  mild: Info,
  moderate: AlertCircle,
  harsh: AlertTriangle,
};

/**
 * Modal displaying harsh feedback analysis results.
 * Shows verbatim quotes of harsh/critical feedback with reviewer attribution.
 * Admin-only feature.
 */
export function HarshFeedbackModal({
  isOpen,
  onClose,
  result,
  employeeName,
}: HarshFeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Harsh Feedback Analysis
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Raw feedback for {employeeName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white dark:hover:bg-gray-700 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No results available
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Analyzed:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {result.summary.total_responses_analyzed} responses
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Flagged:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {result.summary.responses_with_harsh_content}
                    </span>
                  </div>
                  <div>
                    <span className="text-yellow-600 dark:text-yellow-400">Mild:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {result.summary.severity_breakdown.mild}
                    </span>
                  </div>
                  <div>
                    <span className="text-orange-600 dark:text-orange-400">Moderate:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      {result.summary.severity_breakdown.moderate}
                    </span>
                  </div>
                </div>
                {result.summary.severity_breakdown.harsh > 0 && (
                  <div className="mt-2 text-red-600 dark:text-red-400 text-sm">
                    <span>Harsh:</span>
                    <span className="ml-2 font-medium">
                      {result.summary.severity_breakdown.harsh}
                    </span>
                  </div>
                )}
              </div>

              {/* Findings */}
              {result.findings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="p-3 bg-green-100 dark:bg-green-800 rounded-full w-fit mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    No harsh feedback identified in this survey.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    All feedback appears to be constructive and professionally phrased.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Flagged Feedback ({result.findings.length})
                  </h3>
                  {result.findings.map((finding, index) => {
                    const SeverityIcon = severityIcons[finding.severity];
                    return (
                      <div
                        key={`${finding.response_id}-${index}`}
                        className={`p-4 rounded-lg border ${severityColors[finding.severity]}`}
                      >
                        <div className="flex items-start gap-3">
                          <SeverityIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="font-semibold">
                                {finding.reviewer_name}
                              </span>
                              <span className="text-sm px-2 py-0.5 bg-white/50 rounded">
                                {formatRelationship(finding.relationship)}
                              </span>
                              <span className="text-xs uppercase font-medium px-2 py-0.5 rounded bg-white/30">
                                {finding.severity}
                              </span>
                            </div>
                            <p className="text-sm opacity-80 mb-2 italic">
                              Q: {finding.question_text}
                            </p>
                            <blockquote className="border-l-4 border-current/30 pl-3 py-1 my-2">
                              <p className="font-medium">&ldquo;{finding.verbatim_quote}&rdquo;</p>
                            </blockquote>
                            <p className="text-sm opacity-80 mt-2">{finding.context}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This analysis is for admin review only. Content should not be shared
              directly with the subject.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HarshFeedbackModal;
