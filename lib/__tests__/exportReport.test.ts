/**
 * Tests for exportReport.ts - 360 Report PDF Export
 */

// Mock jsPDF
const mockSave = jest.fn();
const mockText = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetFont = jest.fn();
const mockSetTextColor = jest.fn();
const mockSetDrawColor = jest.fn();
const mockSetFillColor = jest.fn();
const mockLine = jest.fn();
const mockRect = jest.fn();
const mockAddPage = jest.fn();
const mockSplitTextToSize = jest.fn().mockImplementation((text) => [text]);
const mockGetNumberOfPages = jest.fn().mockReturnValue(1);
const mockSetPage = jest.fn();

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    save: mockSave,
    text: mockText,
    setFontSize: mockSetFontSize,
    setFont: mockSetFont,
    setTextColor: mockSetTextColor,
    setDrawColor: mockSetDrawColor,
    setFillColor: mockSetFillColor,
    line: mockLine,
    rect: mockRect,
    addPage: mockAddPage,
    splitTextToSize: mockSplitTextToSize,
    getNumberOfPages: mockGetNumberOfPages,
    setPage: mockSetPage,
  }));
});

import { exportReportAsPDF } from '../exportReport';

describe('exportReport.ts - PDF Export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockReport = {
    survey_name: 'Q1 2024 360 Review',
    employee_name: 'John Doe',
    generated_by: 'claude-sonnet-4-20250514',
    generated_at: '2024-01-15T10:00:00Z',
    themes: [
      {
        theme: 'Strong Communication',
        sentiment: 'very_positive',
        frequency: 5,
        supporting_evidence: ['Clear and concise', 'Good listener'],
        relationships_mentioned: ['peer', 'manager'],
      },
      {
        theme: 'Needs Time Management',
        sentiment: 'needs_work',
        frequency: 3,
        supporting_evidence: ['Sometimes misses deadlines'],
        relationships_mentioned: ['direct_report'],
      },
    ],
    overall_strengths: ['Communication', 'Technical skills', 'Leadership'],
    development_areas: ['Time management', 'Delegation'],
    recommendations: ['Take time management course', 'Practice delegation techniques'],
    key_insights: ['Strong technical leader', 'Growing into management role'],
    sentiment_by_relationship: {
      overall: 0.75,
      manager: 0.85,
      peer: 0.70,
      direct_report: 0.80,
      cross_functional: 0.65,
    },
    consensus_areas: ['Technical expertise is outstanding'],
    outlier_opinions: ['Some feedback on work-life balance'],
  };

  describe('exportReportAsPDF', () => {
    it('should create PDF with correct configuration', async () => {
      await exportReportAsPDF(mockReport);

      const jsPDF = require('jspdf');
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
    });

    it('should save PDF with correct filename', async () => {
      const filename = await exportReportAsPDF(mockReport);

      expect(mockSave).toHaveBeenCalledWith(filename);
      expect(filename).toContain('360-Review-John-Doe');
      expect(filename).toContain('.pdf');
    });

    it('should include report title and employee name', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('360° Feedback Report', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('John Doe', expect.any(Number), expect.any(Number));
    });

    it('should include survey name', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Q1 2024 360 Review', expect.any(Number), expect.any(Number));
    });

    it('should include generation metadata', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Generated:'),
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('claude-sonnet-4-20250514'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should include all themes', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Key Themes', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Strong Communication'),
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Needs Time Management'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should display sentiment badges with correct colors', async () => {
      await exportReportAsPDF(mockReport);

      // Very positive theme should have green color
      expect(mockSetTextColor).toHaveBeenCalledWith(16, 185, 129);
      // Needs work theme should have orange color
      expect(mockSetTextColor).toHaveBeenCalledWith(249, 115, 22);
    });

    it('should include theme frequency information', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith(
        'Mentioned by 5 reviewer(s)',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockText).toHaveBeenCalledWith(
        'Mentioned by 3 reviewer(s)',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should include overall strengths section', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Key Strengths', expect.any(Number), expect.any(Number));
      // Check that strengths are formatted with bullet points
      const strengthsCalls = mockText.mock.calls.filter((call: any[]) =>
        call[0]?.includes('Communication') || call[0]?.includes('Technical skills')
      );
      expect(strengthsCalls.length).toBeGreaterThan(0);
    });

    it('should include development areas section', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Development Areas', expect.any(Number), expect.any(Number));
      // Check that splitTextToSize was called with development areas
      const splitCalls = mockSplitTextToSize.mock.calls;
      const hasDevAreas = splitCalls.some((call: any[]) =>
        call[0]?.includes('Time management') || call[0]?.includes('Delegation')
      );
      expect(hasDevAreas).toBe(true);
    });

    it('should include recommendations section', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Recommended Actions', expect.any(Number), expect.any(Number));
      // Check that splitTextToSize was called with recommendations
      const splitCalls = mockSplitTextToSize.mock.calls;
      const hasRecs = splitCalls.some((call: any[]) =>
        call[0]?.includes('time management course') || call[0]?.includes('delegation techniques')
      );
      expect(hasRecs).toBe(true);
    });

    it('should include key insights section', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Key Insights', expect.any(Number), expect.any(Number));
      // Check that splitTextToSize was called with insights
      const splitCalls = mockSplitTextToSize.mock.calls;
      const hasInsights = splitCalls.some((call: any[]) =>
        call[0]?.includes('Strong technical leader') || call[0]?.includes('Growing into management')
      );
      expect(hasInsights).toBe(true);
    });

    it('should include sentiment by relationship section', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Sentiment by Relationship', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Manager:', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Peer:', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Direct Report:', expect.any(Number), expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('Cross-Functional:', expect.any(Number), expect.any(Number));
    });

    it('should render progress bars for sentiment scores', async () => {
      await exportReportAsPDF(mockReport);

      // Should draw progress bars (background + filled)
      expect(mockSetFillColor).toHaveBeenCalled();
      expect(mockRect).toHaveBeenCalled();
    });

    it('should include consensus areas if present', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Strong Consensus', expect.any(Number), expect.any(Number));
      // Check that splitTextToSize was called with consensus areas
      const splitCalls = mockSplitTextToSize.mock.calls;
      const hasConsensus = splitCalls.some((call: any[]) =>
        call[0]?.includes('Technical expertise')
      );
      expect(hasConsensus).toBe(true);
    });

    it('should include outlier opinions if present', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockText).toHaveBeenCalledWith('Unique Perspectives', expect.any(Number), expect.any(Number));
      // Check that splitTextToSize was called with outlier opinions
      const splitCalls = mockSplitTextToSize.mock.calls;
      const hasOutliers = splitCalls.some((call: any[]) =>
        call[0]?.includes('work-life balance')
      );
      expect(hasOutliers).toBe(true);
    });

    it('should add page footer to all pages', async () => {
      mockGetNumberOfPages.mockReturnValue(3);

      await exportReportAsPDF(mockReport);

      expect(mockSetPage).toHaveBeenCalledTimes(3);
      const footerCalls = mockText.mock.calls.filter((call: any[]) =>
        call[0]?.includes('Page') && call[0]?.includes('Generated by Claude AI')
      );
      expect(footerCalls.length).toBe(3);
    });

    it('should use text wrapping for long content', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockSplitTextToSize).toHaveBeenCalled();
    });

    it('should handle empty sections gracefully', async () => {
      const minimalReport = {
        survey_name: 'Test Survey',
        employee_name: 'Test Employee',
        generated_by: 'claude',
        generated_at: new Date().toISOString(),
      };

      await exportReportAsPDF(minimalReport);

      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle report with no themes', async () => {
      const reportWithoutThemes = {
        ...mockReport,
        themes: [],
      };

      await exportReportAsPDF(reportWithoutThemes);

      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle report with no sentiment breakdown', async () => {
      const reportWithoutSentiment = {
        ...mockReport,
        sentiment_by_relationship: {
          overall: 0.8,
        },
      };

      await exportReportAsPDF(reportWithoutSentiment);

      // Should show "No reviewers" for relationships without data
      const noReviewersCalls = mockText.mock.calls.filter((call: any[]) =>
        call[0] === 'No reviewers'
      );
      expect(noReviewersCalls.length).toBeGreaterThan(0);
    });

    it('should format dates correctly', async () => {
      await exportReportAsPDF(mockReport);

      const dateCalls = mockText.mock.calls.filter((call: any[]) =>
        call[0]?.includes('January') && call[0]?.includes('2024')
      );
      expect(dateCalls.length).toBeGreaterThan(0);
    });

    it('should apply section headers with correct font styles', async () => {
      await exportReportAsPDF(mockReport);

      // Bold font for headers
      expect(mockSetFont).toHaveBeenCalledWith('helvetica', 'bold');
      // Normal font for content
      expect(mockSetFont).toHaveBeenCalledWith('helvetica', 'normal');
    });

    it('should use different font sizes for hierarchy', async () => {
      await exportReportAsPDF(mockReport);

      // Title should be largest
      expect(mockSetFontSize).toHaveBeenCalledWith(24);
      // Section headers
      expect(mockSetFontSize).toHaveBeenCalledWith(14);
      // Body text
      expect(mockSetFontSize).toHaveBeenCalledWith(10);
    });

    it('should draw horizontal divider lines', async () => {
      await exportReportAsPDF(mockReport);

      expect(mockLine).toHaveBeenCalled();
      expect(mockSetDrawColor).toHaveBeenCalledWith(200, 200, 200);
    });

    it('should handle very long theme descriptions', async () => {
      const reportWithLongTheme = {
        ...mockReport,
        themes: [
          {
            theme: 'A very long theme name that needs to be wrapped across multiple lines in the PDF',
            sentiment: 'positive',
            frequency: 5,
            supporting_evidence: Array(10).fill('Some evidence that is quite detailed'),
            relationships_mentioned: ['peer'],
          },
        ],
      };

      await exportReportAsPDF(reportWithLongTheme);

      expect(mockSplitTextToSize).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should limit themes shown to top 5', async () => {
      const reportWithManyThemes = {
        ...mockReport,
        themes: Array.from({ length: 10 }, (_, i) => ({
          theme: `Theme ${i + 1}`,
          sentiment: 'positive' as const,
          frequency: 5,
          supporting_evidence: ['Evidence'],
          relationships_mentioned: ['peer' as const],
        })),
      };

      await exportReportAsPDF(reportWithManyThemes);

      // Should only show top 5 themes
      const themeCalls = mockText.mock.calls.filter((call: any[]) =>
        call[0]?.includes('Theme')
      );
      // Each theme appears multiple times (title, frequency, evidence)
      // But should not include Theme 6-10
      expect(themeCalls.every((call: any[]) =>
        !call[0]?.includes('Theme 6') &&
        !call[0]?.includes('Theme 7') &&
        !call[0]?.includes('Theme 10')
      )).toBe(true);
    });

    it('should limit supporting evidence to 2 items per theme', async () => {
      const reportWithManyEvidence = {
        ...mockReport,
        themes: [
          {
            theme: 'Test Theme',
            sentiment: 'positive' as const,
            frequency: 5,
            supporting_evidence: [
              'Evidence 1',
              'Evidence 2',
              'Evidence 3',
              'Evidence 4',
              'Evidence 5',
            ],
            relationships_mentioned: ['peer' as const],
          },
        ],
      };

      await exportReportAsPDF(reportWithManyEvidence);

      // Check that only first 2 evidence items are passed to splitTextToSize
      const splitCalls = mockSplitTextToSize.mock.calls;
      const hasEvidence1 = splitCalls.some((call: any[]) => call[0]?.includes('Evidence 1'));
      const hasEvidence2 = splitCalls.some((call: any[]) => call[0]?.includes('Evidence 2'));
      const hasEvidence3 = splitCalls.some((call: any[]) => call[0]?.includes('Evidence 3'));

      expect(hasEvidence1).toBe(true);
      expect(hasEvidence2).toBe(true);
      expect(hasEvidence3).toBe(false);
    });
  });
});
