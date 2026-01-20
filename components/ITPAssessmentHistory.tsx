'use client';

import React, { useState } from 'react';
import { ITPAssessment, ITPVirtue } from '@/types';
import { getBehaviorsByVirtue, getBehaviorByKey, VIRTUE_CONFIG, RATING_LABELS } from '@/lib/itpBehaviors';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface ITPAssessmentHistoryProps {
  assessments: ITPAssessment[];
}

interface ExpandedAssessmentViewProps {
  assessment: ITPAssessment;
}

/**
 * ExpandedAssessmentView Component
 *
 * Shows detailed view of a past assessment with all ratings.
 */
function ExpandedAssessmentView({ assessment }: ExpandedAssessmentViewProps) {
  const behaviorsByVirtue = getBehaviorsByVirtue();

  // Build response map
  const responseMap: Record<string, number> = {};
  assessment.responses?.forEach((r: any) => {
    responseMap[r.behaviorKey || r.behavior_key] = r.rating;
  });

  // Calculate virtue averages
  const virtueAverages: Record<ITPVirtue, number> = {
    humble: 0,
    hungry: 0,
    people_smart: 0,
  };

  (['humble', 'hungry', 'people_smart'] as ITPVirtue[]).forEach((virtue) => {
    const behaviors = behaviorsByVirtue[virtue];
    const ratings = behaviors.map(b => responseMap[b.behaviorKey]).filter(r => r !== undefined);
    if (ratings.length > 0) {
      virtueAverages[virtue] = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    }
  });

  // Get rating color
  const getRatingColor = (rating: number): string => {
    if (rating <= 2) return 'bg-red-100 text-red-700 border-red-200';
    if (rating === 3) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Virtue Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['humble', 'hungry', 'people_smart'] as ITPVirtue[]).map((virtue) => {
          const config = VIRTUE_CONFIG[virtue];
          const avg = virtueAverages[virtue];

          return (
            <div
              key={virtue}
              className={`p-3 rounded-lg border ${config.borderColor} ${config.bgColor}`}
            >
              <div className={`font-semibold ${config.color} text-sm`}>
                {config.displayName}
              </div>
              <div className={`text-2xl font-bold ${config.color}`}>
                {avg > 0 ? avg.toFixed(1) : '-'}
              </div>
              <div className="text-xs text-gray-500">avg rating</div>
            </div>
          );
        })}
      </div>

      {/* Detailed Breakdown */}
      {(['humble', 'hungry', 'people_smart'] as ITPVirtue[]).map((virtue) => {
        const config = VIRTUE_CONFIG[virtue];
        const behaviors = behaviorsByVirtue[virtue];

        return (
          <div key={virtue} className="space-y-2">
            <h5 className={`font-medium ${config.color} text-sm`}>
              {config.displayName}
            </h5>
            <div className="space-y-1">
              {behaviors.map((behavior) => {
                const rating = responseMap[behavior.behaviorKey];

                return (
                  <div
                    key={behavior.behaviorKey}
                    className="flex items-center justify-between py-1 px-2 bg-white rounded border border-gray-100"
                  >
                    <span className="text-sm text-gray-700">{behavior.behaviorName}</span>
                    {rating !== undefined ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded border ${getRatingColor(rating)}`}
                      >
                        {rating} - {RATING_LABELS[rating] || 'In Progress'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not rated</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ITPAssessmentHistory Component
 *
 * Shows a list of past (archived) ITP assessments with expandable details.
 */
export function ITPAssessmentHistory({ assessments }: ITPAssessmentHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (assessments.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate overall average for an assessment
  const getOverallAverage = (assessment: ITPAssessment): number => {
    const ratings = assessment.responses?.map((r: any) => r.rating) || [];
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length;
  };

  return (
    <div className="mt-4 space-y-3">
      {assessments.map((assessment) => {
        const isExpanded = expandedId === assessment.id;
        const avg = getOverallAverage(assessment);
        const ratedCount = assessment.responses?.length || 0;

        return (
          <div
            key={assessment.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Header - clickable */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : assessment.id)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">
                    {assessment.submitted_at
                      ? formatDate(assessment.submitted_at)
                      : formatDate(assessment.created_at)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {ratedCount} behaviors rated
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {avg > 0 ? avg.toFixed(1) : '-'}
                  </div>
                  <div className="text-xs text-gray-500">overall avg</div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 bg-white">
                <ExpandedAssessmentView assessment={assessment} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ITPAssessmentHistory;
