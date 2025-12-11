/**
 * Report Filtering Utilities
 *
 * Provides role-based data filtering for 360 feedback reports:
 * - Sponsors/Admins: See full report with relationship breakdowns and citations
 * - Subjects: See anonymized report with only aggregated data (no citations)
 */

import type { Feedback360Report } from './schema';

/**
 * Strip citation data from a CitedStatement array, leaving only the text
 */
function stripCitationsFromStatements(statements: any[]): string[] {
  if (!Array.isArray(statements)) return [];

  return statements.map((item) => {
    // If it's a CitedStatement object with text property, extract just the text
    if (typeof item === 'object' && item !== null && 'text' in item) {
      return item.text;
    }
    // If it's already a string, return as-is
    return item;
  });
}

/**
 * Strip citation data from themes
 */
function stripCitationsFromThemes(themes: any[]): any[] {
  if (!Array.isArray(themes)) return [];

  return themes.map((theme) => ({
    ...theme,
    relationships_mentioned: undefined,
    // Convert supporting_evidence from CitedStatement[] to string[]
    supporting_evidence: Array.isArray(theme.supporting_evidence)
      ? theme.supporting_evidence.map((evidence: any) => {
          if (typeof evidence === 'object' && evidence !== null && 'text' in evidence) {
            return evidence.text;
          }
          return evidence;
        })
      : theme.supporting_evidence || [],
  }));
}

/**
 * Filter report data for subject view
 *
 * Removes sensitive relationship-specific data that should only be visible
 * to sponsors and admins:
 * - Per-relationship sentiment scores (manager, peer, direct_report, cross_functional)
 * - Relationship attributions in themes
 * - All citation data (subjects should not have access to audit mode)
 *
 * @param fullReport - The complete report with all data
 * @returns Filtered report suitable for subject viewing
 */
export function filterReportForSubject(
  fullReport: Feedback360Report
): Feedback360Report {
  console.log('[filterReport] Filtering report for subject view');
  console.log('[filterReport] Before - sentiment_by_relationship keys:', Object.keys(fullReport.sentiment_by_relationship || {}));

  const filtered = {
    ...fullReport,
    // Keep only overall sentiment score, remove per-relationship breakdowns
    sentiment_by_relationship: {
      overall: fullReport.sentiment_by_relationship?.overall || 0,
    },
    // Remove relationship attributions and citations from themes
    themes: stripCitationsFromThemes(fullReport.themes || []),
    // Strip citations from all statement arrays (convert CitedStatement[] to string[])
    overall_strengths: stripCitationsFromStatements(fullReport.overall_strengths || []),
    development_areas: stripCitationsFromStatements(fullReport.development_areas || []),
    recommendations: stripCitationsFromStatements(fullReport.recommendations || []),
    consensus_areas: stripCitationsFromStatements(fullReport.consensus_areas || []),
    outlier_opinions: stripCitationsFromStatements(fullReport.outlier_opinions || []),
    // Remove citation metadata
    has_citations: false,
    citation_version: undefined,
    total_citations: undefined,
    citation_coverage: undefined,
  };

  console.log('[filterReport] After - sentiment_by_relationship keys:', Object.keys(filtered.sentiment_by_relationship || {}));
  console.log('[filterReport] After - citations stripped for subject view');

  return filtered;
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

/**
 * Filter report data for sponsor view (non-admin)
 *
 * Sponsors can see the full report with relationship breakdowns,
 * but NEVER see citations. Only admins can use the audit mode.
 *
 * @param fullReport - The complete report with all data
 * @returns Report with citations stripped but relationship data intact
 */
export function filterReportForSponsor(
  fullReport: Feedback360Report
): Feedback360Report {
  console.log('[filterReport] Filtering report for sponsor view (citations removed)');

  const filtered = {
    ...fullReport,
    // Keep relationship breakdowns - sponsors can see these
    sentiment_by_relationship: fullReport.sentiment_by_relationship,
    // Strip citations from all statement arrays
    themes: stripCitationsFromThemes(fullReport.themes || []),
    overall_strengths: stripCitationsFromStatements(fullReport.overall_strengths || []),
    development_areas: stripCitationsFromStatements(fullReport.development_areas || []),
    recommendations: stripCitationsFromStatements(fullReport.recommendations || []),
    consensus_areas: stripCitationsFromStatements(fullReport.consensus_areas || []),
    outlier_opinions: stripCitationsFromStatements(fullReport.outlier_opinions || []),
    // Remove citation metadata - sponsors should not know citations exist
    has_citations: false,
    citation_version: undefined,
    total_citations: undefined,
    citation_coverage: undefined,
    citation_validation_status: undefined,
    citation_validated_at: undefined,
    validation_errors: undefined,
  };

  return filtered;
}

/**
 * Determine if citations should be visible to the current user
 *
 * Citations are ONLY visible to admins. Sponsors and subjects never see them.
 *
 * @param userRole - The user's application role
 * @returns true if user can see citations (admin only)
 */
export function canViewCitations(userRole: string): boolean {
  return userRole === 'admin';
}
