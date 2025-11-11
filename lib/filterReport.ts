/**
 * Report Filtering Utilities
 *
 * Provides role-based data filtering for 360 feedback reports:
 * - Sponsors/Admins: See full report with relationship breakdowns
 * - Subjects: See anonymized report with only aggregated data
 */

import type { Feedback360Report } from './schema';

/**
 * Filter report data for subject view
 *
 * Removes sensitive relationship-specific data that should only be visible
 * to sponsors and admins:
 * - Per-relationship sentiment scores (manager, peer, direct_report, cross_functional)
 * - Relationship attributions in themes
 *
 * @param fullReport - The complete report with all data
 * @returns Filtered report suitable for subject viewing
 */
export function filterReportForSubject(
  fullReport: Feedback360Report
): Feedback360Report {
  return {
    ...fullReport,
    // Keep only overall sentiment score, remove per-relationship breakdowns
    sentiment_by_relationship: {
      overall: fullReport.sentiment_by_relationship.overall || 0,
    },
    // Remove relationship attributions from themes
    themes: fullReport.themes.map((theme) => ({
      ...theme,
      relationships_mentioned: undefined,
    })),
  };
}

/**
 * Determine if a user can view the full report (with relationship breakdowns)
 *
 * @param userRole - The user's application role
 * @param surveyCreatedBy - The user ID who created/sponsored the survey
 * @param currentUserId - The current viewing user's ID
 * @returns true if user should see full report, false if filtered view
 */
export function canViewFullReport(
  userRole: string,
  surveyCreatedBy: string,
  currentUserId: string
): boolean {
  // Admins always see full reports
  if (userRole === 'admin') {
    return true;
  }

  // Survey sponsors (creators) see full reports
  if (surveyCreatedBy === currentUserId) {
    return true;
  }

  // All others (including subjects) see filtered reports
  return false;
}

/**
 * Check if sentiment_by_relationship contains per-relationship data
 * (not just overall score)
 *
 * @param sentimentData - The sentiment_by_relationship object
 * @returns true if contains relationship-specific scores
 */
export function hasRelationshipBreakdown(sentimentData: {
  overall?: number;
  manager?: number;
  peer?: number;
  direct_report?: number;
  cross_functional?: number;
}): boolean {
  return !!(
    sentimentData.manager !== undefined ||
    sentimentData.peer !== undefined ||
    sentimentData.direct_report !== undefined ||
    sentimentData.cross_functional !== undefined
  );
}
