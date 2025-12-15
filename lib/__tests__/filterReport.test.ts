/**
 * Tests for filterReport.ts - Report Filtering Utilities
 */

import {
  filterReportForSubject,
  canViewFullReport,
} from '../filterReport';
import type { Feedback360Report } from '../schema';

describe('filterReport.ts - Report Filtering', () => {
  const mockFullReport: Feedback360Report = {
    id: 'report-1',
    survey_id: 'survey-1',
    themes: [
      {
        theme: 'Strong Communication',
        sentiment: 'very_positive',
        frequency: 5,
        supporting_evidence: ['Clear and concise', 'Good listener'],
        relationships_mentioned: ['peer', 'manager'],
      },
      {
        theme: 'Needs Delegation',
        sentiment: 'needs_work',
        frequency: 3,
        supporting_evidence: ['Takes on too much'],
        relationships_mentioned: ['direct_report'],
      },
    ],
    overall_strengths: ['Communication', 'Technical skills'],
    development_areas: ['Delegation', 'Time management'],
    recommendations: ['Take leadership course', 'Practice delegation'],
    sentiment_by_relationship: {
      overall: 0.75,
      manager: 0.85,
      peer: 0.70,
      direct_report: 0.80,
      cross_functional: 0.65,
    },
    key_insights: ['Strong technical leader', 'Growing into management'],
    consensus_areas: ['Technical expertise'],
    outlier_opinions: ['Some feedback on work-life balance'],
    generated_by: 'claude-sonnet-4',
    generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe('filterReportForSubject', () => {
    it('should remove relationships_mentioned from themes', () => {
      const filtered = filterReportForSubject(mockFullReport);

      filtered.themes.forEach(theme => {
        expect(theme.relationships_mentioned).toBeUndefined();
      });
    });

    it('should preserve all other report data', () => {
      const filtered = filterReportForSubject(mockFullReport);

      expect(filtered.id).toBe(mockFullReport.id);
      expect(filtered.survey_id).toBe(mockFullReport.survey_id);
      expect(filtered.overall_strengths).toEqual(mockFullReport.overall_strengths);
      expect(filtered.development_areas).toEqual(mockFullReport.development_areas);
      expect(filtered.recommendations).toEqual(mockFullReport.recommendations);
      expect(filtered.key_insights).toEqual(mockFullReport.key_insights);
      expect(filtered.consensus_areas).toEqual(mockFullReport.consensus_areas);
      expect(filtered.outlier_opinions).toEqual(mockFullReport.outlier_opinions);
    });

    it('should preserve theme data except relationships', () => {
      const filtered = filterReportForSubject(mockFullReport);

      expect(filtered.themes).toHaveLength(2);
      expect(filtered.themes[0].theme).toBe('Strong Communication');
      expect(filtered.themes[0].sentiment).toBe('very_positive');
      expect(filtered.themes[0].supporting_evidence).toEqual(['Clear and concise', 'Good listener']);
    });

    it('should handle empty themes array', () => {
      const reportWithNoThemes = {
        ...mockFullReport,
        themes: [],
      };

      const filtered = filterReportForSubject(reportWithNoThemes);

      expect(filtered.themes).toEqual([]);
    });
  });

  describe('canViewFullReport', () => {
    it('should allow admins to view full report', () => {
      const result = canViewFullReport('admin', 'user-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should allow survey creator to view full report', () => {
      const result = canViewFullReport('user', 'user-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should allow survey creator with leader role', () => {
      const result = canViewFullReport('leader', 'user-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should not allow non-admin, non-creator to view full report', () => {
      const result = canViewFullReport('user', 'user-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should not allow leader who is not creator', () => {
      const result = canViewFullReport('leader', 'user-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should not allow subject (employee being reviewed)', () => {
      const result = canViewFullReport('user', 'manager-1', 'employee-1');

      expect(result).toBe(false);
    });

    it('should handle empty user IDs', () => {
      const result = canViewFullReport('user', '', '');

      expect(result).toBe(true); // Empty strings match
    });

    it('should be case-sensitive for role comparison', () => {
      const result = canViewFullReport('Admin', 'user-1', 'user-2');

      expect(result).toBe(false); // 'Admin' !== 'admin'
    });
  });

  describe('Integration scenarios', () => {
    it('should properly filter report for subject viewing', () => {
      const canView = canViewFullReport('user', 'manager-1', 'employee-1');
      const filtered = canView ? mockFullReport : filterReportForSubject(mockFullReport);

      expect(canView).toBe(false);
      // Verify relationships are stripped from themes
      filtered.themes.forEach(theme => {
        expect(theme.relationships_mentioned).toBeUndefined();
      });
    });

    it('should not filter report for admin viewing', () => {
      const canView = canViewFullReport('admin', 'manager-1', 'admin-1');
      const report = canView ? mockFullReport : filterReportForSubject(mockFullReport);

      expect(canView).toBe(true);
      // Admin should see full report with relationships
      expect(report.themes[0].relationships_mentioned).toEqual(['peer', 'manager']);
    });

    it('should not filter report for survey creator', () => {
      const canView = canViewFullReport('leader', 'leader-1', 'leader-1');
      const report = canView ? mockFullReport : filterReportForSubject(mockFullReport);

      expect(canView).toBe(true);
      // Creator should see full report with relationships
      expect(report.themes[0].relationships_mentioned).toEqual(['peer', 'manager']);
    });

    it('should handle full workflow: check permission, filter if needed', () => {
      const scenarios = [
        { role: 'admin', creator: 'user-1', viewer: 'admin-1', shouldFilter: false },
        { role: 'leader', creator: 'leader-1', viewer: 'leader-1', shouldFilter: false },
        { role: 'user', creator: 'manager-1', viewer: 'employee-1', shouldFilter: true },
        { role: 'leader', creator: 'admin-1', viewer: 'leader-1', shouldFilter: true },
      ];

      scenarios.forEach(({ role, creator, viewer, shouldFilter }) => {
        const canView = canViewFullReport(role, creator, viewer);
        expect(canView).toBe(!shouldFilter);

        if (!canView) {
          const filtered = filterReportForSubject(mockFullReport);
          // Verify relationships are stripped when filtered
          filtered.themes.forEach(theme => {
            expect(theme.relationships_mentioned).toBeUndefined();
          });
        }
      });
    });
  });
});
