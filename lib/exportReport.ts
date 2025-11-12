/**
 * Report Export Utilities
 *
 * Provides functionality to export 360 feedback reports as PDF
 */

import jsPDF from 'jspdf';

interface Report360Data {
  survey_name: string;
  employee_name: string;
  generated_by: string;
  generated_at: string;
  themes?: Array<{
    theme: string;
    sentiment: string;
    frequency: number;
    supporting_evidence?: string[];
    relationships_mentioned?: string[];
  }>;
  overall_strengths?: string[];
  development_areas?: string[];
  recommendations?: string[];
  key_insights?: string[];
  sentiment_by_relationship?: Record<string, number>;
  consensus_areas?: string[];
  outlier_opinions?: string[];
}

/**
 * Export 360 feedback report as PDF
 */
export async function exportReportAsPDF(report: Report360Data) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  let yPosition = margin;

  // Helper to add new page if needed
  const checkPageBreak = (neededSpace: number = 20) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper to add text with wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return lines.length * (fontSize * 0.35); // Return height used
  };

  // ==========================================================================
  // PAGE 1: COVER PAGE & SUMMARY
  // ==========================================================================

  // Title
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('360° Feedback Report', margin, yPosition);
  yPosition += 15;

  // Employee name
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.text(report.employee_name || 'Unknown Employee', margin, yPosition);
  yPosition += 10;

  // Survey name
  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text(report.survey_name || 'Untitled Survey', margin, yPosition);
  yPosition += 15;

  // Horizontal line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Metadata
  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 120);
  const generatedDate = new Date(report.generated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  pdf.text(`Generated: ${generatedDate}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`AI Model: ${report.generated_by || 'Claude AI'}`, margin, yPosition);
  yPosition += 15;

  // Key Themes Section
  if (report.themes && report.themes.length > 0) {
    checkPageBreak(30);

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('Key Themes', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    report.themes.slice(0, 5).forEach((theme, idx) => {
      checkPageBreak(25);

      // Theme title and sentiment
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${idx + 1}. ${theme.theme}`, margin + 5, yPosition);

      // Sentiment badge with constructive language
      const sentimentColors: Record<string, [number, number, number]> = {
        very_positive: [16, 185, 129], // emerald-500
        positive: [34, 197, 94],        // green-500
        mixed: [234, 179, 8],           // yellow-500
        needs_work: [249, 115, 22],     // orange-500
        critical: [239, 68, 68]         // red-500
      };
      const sentimentLabels: Record<string, string> = {
        very_positive: 'VERY POSITIVE',
        positive: 'POSITIVE',
        mixed: 'MIXED',
        needs_work: 'NEEDS WORK',
        critical: 'CRITICAL'
      };
      const color = sentimentColors[theme.sentiment] || [156, 163, 175];
      const label = sentimentLabels[theme.sentiment] || theme.sentiment.toUpperCase();
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(`[${label}]`, pageWidth - margin - 35, yPosition);
      pdf.setTextColor(0, 0, 0);

      yPosition += 6;

      // Frequency
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Mentioned by ${theme.frequency} reviewer(s)`, margin + 5, yPosition);
      yPosition += 5;

      // Supporting evidence (first 2)
      if (theme.supporting_evidence && theme.supporting_evidence.length > 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        theme.supporting_evidence.slice(0, 2).forEach(evidence => {
          checkPageBreak(15);
          const height = addWrappedText(evidence, margin + 8, yPosition, contentWidth - 8, 9);
          yPosition += height + 3;
        });
      }

      yPosition += 3;
    });
  }

  // ==========================================================================
  // PAGE 2: STRENGTHS & DEVELOPMENT AREAS
  // ==========================================================================

  checkPageBreak(50);
  yPosition += 5;

  // Overall Strengths
  if (report.overall_strengths && report.overall_strengths.length > 0) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(34, 197, 94); // Green
    pdf.text('Key Strengths', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    report.overall_strengths.forEach((strength, idx) => {
      checkPageBreak(15);
      const height = addWrappedText(`• ${strength}`, margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += height + 3;
    });

    yPosition += 5;
  }

  // Development Areas
  if (report.development_areas && report.development_areas.length > 0) {
    checkPageBreak(30);

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(245, 158, 11); // Amber
    pdf.text('Development Areas', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    report.development_areas.forEach((area, idx) => {
      checkPageBreak(15);
      const height = addWrappedText(`• ${area}`, margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += height + 3;
    });

    yPosition += 5;
  }

  // ==========================================================================
  // PAGE 3: RECOMMENDATIONS & INSIGHTS
  // ==========================================================================

  checkPageBreak(50);

  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(59, 130, 246); // Blue
    pdf.text('Recommended Actions', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    report.recommendations.forEach((rec, idx) => {
      checkPageBreak(15);
      const height = addWrappedText(`${idx + 1}. ${rec}`, margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += height + 3;
    });

    yPosition += 5;
  }

  // Key Insights
  if (report.key_insights && report.key_insights.length > 0) {
    checkPageBreak(30);

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(147, 51, 234); // Purple
    pdf.text('Key Insights', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    report.key_insights.forEach((insight, idx) => {
      checkPageBreak(15);
      const height = addWrappedText(`• ${insight}`, margin + 5, yPosition, contentWidth - 5, 10);
      yPosition += height + 3;
    });

    yPosition += 5;
  }

  // Sentiment by Relationship
  // Only show this section if there's per-relationship data (not just overall score)
  const hasRelationshipData = report.sentiment_by_relationship &&
    (report.sentiment_by_relationship.manager !== undefined ||
     report.sentiment_by_relationship.peer !== undefined ||
     report.sentiment_by_relationship.direct_report !== undefined ||
     report.sentiment_by_relationship.cross_functional !== undefined);

  if (hasRelationshipData) {
    checkPageBreak(60);

    // Add divider and notice before sponsor/admin-only sections
    pdf.setDrawColor(251, 191, 36); // Amber-400
    pdf.setLineWidth(1);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Notice text
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(180, 83, 9); // Amber-700
    const noticeText = '⚠ SPONSOR/ADMIN ONLY - The sections below are not visible to the employee being reviewed';
    const textWidth = pdf.getTextWidth(noticeText);
    const availableWidth = pageWidth - (2 * margin);

    if (textWidth > availableWidth) {
      // Split into two lines if too long
      const line1 = '⚠ SPONSOR/ADMIN ONLY';
      const line2 = 'The sections below are not visible to the employee being reviewed';
      pdf.text(line1, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4;
      pdf.text(line2, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
    } else {
      pdf.text(noticeText, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
    }

    pdf.setDrawColor(251, 191, 36); // Amber-400
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('Sentiment by Relationship', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const validRelationships = ['manager', 'peer', 'direct_report', 'cross_functional'];
    const relationshipLabels: Record<string, string> = {
      manager: 'Manager',
      peer: 'Peer',
      direct_report: 'Direct Report',
      cross_functional: 'Cross-Functional'
    };

    validRelationships.forEach((relationship) => {
      checkPageBreak(10);
      const score = report.sentiment_by_relationship![relationship];
      const hasReviewers = score !== undefined && score !== null;
      const label = relationshipLabels[relationship];

      pdf.text(`${label}:`, margin + 5, yPosition);

      if (hasReviewers) {
        const percentage = ((score as number) * 100).toFixed(0);
        pdf.text(`${percentage}%`, margin + 60, yPosition);

        // Draw progress bar
        const barWidth = 80;
        const barHeight = 4;
        const barX = margin + 75;
        const barY = yPosition - 3;

        // Background bar
        pdf.setFillColor(230, 230, 230);
        pdf.rect(barX, barY, barWidth, barHeight, 'F');

        // Filled bar
        pdf.setFillColor(147, 51, 234); // Purple
        pdf.rect(barX, barY, barWidth * (score as number), barHeight, 'F');
      } else {
        pdf.setTextColor(120, 120, 120);
        pdf.text('No reviewers', margin + 60, yPosition);
        pdf.setTextColor(0, 0, 0);
      }

      yPosition += 8;
    });

    yPosition += 5;
  }

  // Consensus & Outliers (if space allows)
  if (report.consensus_areas && report.consensus_areas.length > 0) {
    checkPageBreak(25);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(34, 197, 94);
    pdf.text('Strong Consensus', margin, yPosition);
    yPosition += 6;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    report.consensus_areas.forEach(area => {
      checkPageBreak(10);
      const height = addWrappedText(`• ${area}`, margin + 5, yPosition, contentWidth - 5, 9);
      yPosition += height + 2;
    });

    yPosition += 3;
  }

  if (report.outlier_opinions && report.outlier_opinions.length > 0) {
    checkPageBreak(25);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(245, 158, 11);
    pdf.text('Unique Perspectives', margin, yPosition);
    yPosition += 6;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    report.outlier_opinions.forEach(opinion => {
      checkPageBreak(10);
      const height = addWrappedText(`• ${opinion}`, margin + 5, yPosition, contentWidth - 5, 9);
      yPosition += height + 2;
    });
  }

  // Footer on each page
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} of ${totalPages} | Generated by Claude AI`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename
  const filename = `360-Review-${report.employee_name?.replace(/\s+/g, '-') || 'Report'}-${new Date().toISOString().split('T')[0]}.pdf`;

  // Save PDF
  pdf.save(filename);

  return filename;
}
