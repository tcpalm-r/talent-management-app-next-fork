/**
 * Report Export Utilities
 *
 * Provides functionality to export 360 feedback reports as PDF
 */

import jsPDF from 'jspdf';

// Sonance brand color (from brand guidelines)
const SONANCE_DARK = '#39464F'; // Sonance dark gray for text

/**
 * Load image from URL and convert to base64 for PDF embedding
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Load Montserrat font from Google Fonts and register with jsPDF
 */
async function loadMontserratFont(pdf: jsPDF): Promise<boolean> {
  try {
    // Fetch Montserrat Regular and Bold from Google Fonts
    const regularUrl = 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf';
    const boldUrl = 'https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf';

    const [regularResponse, boldResponse] = await Promise.all([
      fetch(regularUrl),
      fetch(boldUrl)
    ]);

    if (!regularResponse.ok || !boldResponse.ok) return false;

    const [regularBuffer, boldBuffer] = await Promise.all([
      regularResponse.arrayBuffer(),
      boldResponse.arrayBuffer()
    ]);

    // Convert to base64
    const regularBase64 = btoa(
      new Uint8Array(regularBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const boldBase64 = btoa(
      new Uint8Array(boldBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Register fonts with jsPDF
    pdf.addFileToVFS('Montserrat-Regular.ttf', regularBase64);
    pdf.addFileToVFS('Montserrat-Bold.ttf', boldBase64);
    pdf.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal');
    pdf.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');

    return true;
  } catch (error) {
    console.error('Failed to load Montserrat font:', error);
    return false;
  }
}

// Type for statements that may be strings or CitedStatement objects
type StatementOrCited = string | { text: string; citations?: any[] };

// Helper function to extract text from either a plain string or CitedStatement object
// Also handles JSON-stringified objects (from database text[] columns storing objects)
const getStatementText = (item: StatementOrCited): string => {
  // Already a proper object with text property
  if (item && typeof item === 'object' && 'text' in item) {
    return item.text;
  }

  // String that might be JSON-encoded object
  if (typeof item === 'string') {
    // Check if it looks like a JSON object (starts with { and contains "text":)
    if (item.startsWith('{') && item.includes('"text"')) {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object' && 'text' in parsed) {
          return parsed.text;
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }
    return item;
  }

  return String(item);
};

// New v2 structure types
type ConsensusAreaV2 = {
  text: string;
  groups_agreeing?: string[];
  citations?: any[];
};

type VariedPerspective = {
  group: string;
  view: string;
  citations?: any[];
};

type VariedByRelationship = {
  topic: string;
  perspectives: VariedPerspective[];
};

type OutlierV2 = {
  text: string;
  citations?: any[];
};

interface Report360Data {
  survey_name: string;
  employee_name: string;
  generated_by: string;
  generated_at: string;
  executive_summary?: string;
  final_narrative?: string;
  themes?: Array<{
    theme: string;
    sentiment: string;
    frequency: number;
    supporting_evidence?: StatementOrCited[];
    relationships_mentioned?: string[];
  }>;
  overall_strengths?: StatementOrCited[];
  development_areas?: StatementOrCited[];
  recommendations?: StatementOrCited[];
  // New v2 structure
  consensus_areas?: (StatementOrCited | ConsensusAreaV2)[];
  varied_by_relationship?: VariedByRelationship[];
  outliers?: OutlierV2[];
  // Backward compatibility
  outlier_opinions?: StatementOrCited[];
}

/**
 * Format group name for PDF display
 */
const formatGroupLabelForPDF = (group: string, subjectFirstName: string): string => {
  const name = subjectFirstName || 'Subject';
  const normalizedGroup = group?.toLowerCase()?.trim() || '';

  // Handle exact matches first
  switch (normalizedGroup) {
    case 'manager':
      return `${name}'s Manager`;
    case 'direct_report':
    case 'direct_reports':
      return `${name}'s Direct Reports`;
    case 'cross_functional':
    case 'cross-functional':
    case 'cross-functional colleagues':
      return 'Cross-functional';
    case 'slt':
      return 'SLT';
    case 'peer':
    case 'peers':
      return 'Peers';
  }

  // Handle AI-generated labels that contain "Subject's" - replace with actual name
  if (normalizedGroup.includes("subject's")) {
    return group.replace(/subject's/gi, `${name}'s`);
  }

  // Handle partial matches for common group types
  if (normalizedGroup.includes('direct report')) {
    return `${name}'s Direct Reports`;
  }
  if (normalizedGroup.includes('manager')) {
    return `${name}'s Manager`;
  }
  if (normalizedGroup.includes('cross') && normalizedGroup.includes('functional')) {
    return 'Cross-functional';
  }

  return group || 'Unknown';
};

/**
 * Get short group label for badges
 */
const getShortGroupLabelForPDF = (group: string): string => {
  switch (group?.toLowerCase()) {
    case 'manager':
      return 'Manager';
    case 'direct_report':
    case 'direct_reports':
      return 'Direct Reports';
    case 'cross_functional':
      return 'Cross-func';
    case 'slt':
      return 'SLT';
    case 'peer':
    case 'peers':
      return 'Peers';
    default:
      return group || '?';
  }
};

/**
 * Export 360 feedback report as PDF
 */
export async function exportReportAsPDF(report: Report360Data, suffix?: string) {
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

  // Load Montserrat font (Sonance brand font)
  const fontLoaded = await loadMontserratFont(pdf);
  const fontFamily = fontLoaded ? 'Montserrat' : 'helvetica';

  // Helper to add new page if needed
  const checkPageBreak = (neededSpace: number = 25) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper to add text with wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10, lineSpacing: number = 1.5) => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);

    lines.forEach((line: string, index: number) => {
      pdf.text(line, x, y + (index * fontSize * 0.35 * lineSpacing));
    });

    return lines.length * (fontSize * 0.35 * lineSpacing); // Return height used
  };

  // ==========================================================================
  // PAGE 1: HEADER
  // ==========================================================================

  // Load Sonance logo
  const logoUrl = '/logos/Sonance_Logo_2C_Dark_RGB.png';
  const logoBase64 = await loadImageAsBase64(logoUrl);

  // Logo dimensions: 1973x312 pixels (6.32:1 aspect ratio)
  const logoWidth = 35; // mm - compact size for header
  const logoHeight = logoWidth / 6.32; // ~5.5mm maintains aspect ratio

  if (logoBase64) {
    pdf.addImage(logoBase64, 'PNG', margin, yPosition, logoWidth, logoHeight);
  }

  // Date on the right side of header, aligned with logo
  pdf.setFont(fontFamily, 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  const generatedDate = new Date(report.generated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  pdf.text(generatedDate, pageWidth - margin, yPosition + logoHeight / 2 + 1, { align: 'right' });

  yPosition += logoHeight + 6;

  // Thin separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 18; // Extra spacing before title

  // Title with employee name
  let employeeName = report.employee_name?.trim() || '';
  if (!employeeName && report.survey_name) {
    const match = report.survey_name.match(/360°?\s*Feedback\s*-\s*(.+)/i);
    if (match) {
      employeeName = match[1].trim();
    }
  }

  pdf.setFontSize(22);
  pdf.setFont(fontFamily, 'bold');
  pdf.setTextColor(0, 0, 0);
  const titleText = '360° Feedback';
  pdf.text(titleText, margin, yPosition);
  yPosition += 8;

  // Employee name as subtitle
  if (employeeName) {
    pdf.setFontSize(14);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(80, 80, 80);
    pdf.text(employeeName, margin, yPosition);
    yPosition += 12;
  } else {
    yPosition += 4;
  }

  // ==========================================================================
  // NARRATIVE - First content after cover page, no header, just the text
  // ==========================================================================
  if (report.final_narrative) {
    checkPageBreak(30);

    // Clean narrative
    let narrative = report.final_narrative
      .replace(/^#+\s+/gm, '')
      .replace(/^Executive Summary:?\s*/i, '')
      .replace(/\*\*/g, '')
      .trim();

    // Split into paragraphs
    const paragraphs = narrative.split(/\n\n+/).filter(p => p.trim());

    pdf.setFontSize(10);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(0, 0, 0);

    const lineHeight = 10 * 0.35 * 1.5; // 1.5x line spacing for 10pt font
    const minLinesOnPage = 3; // Minimum lines to keep together (avoid orphans/widows)

    paragraphs.forEach((paragraph, index) => {
      const cleanParagraph = paragraph.replace(/\n/g, ' ').trim();
      const lines = pdf.splitTextToSize(cleanParagraph, contentWidth);
      const paragraphHeight = lines.length * lineHeight;
      const availableSpace = pageHeight - margin - 10 - yPosition;
      const linesOnCurrentPage = Math.floor(availableSpace / lineHeight);

      // Smart page break logic:
      // - If whole paragraph fits, render it
      // - If only 1-2 lines would fit on current page, move whole paragraph (avoid orphan)
      // - Otherwise split, but ensure at least 3 lines carry over (avoid widow)
      const needsPageBreak = paragraphHeight > availableSpace;
      const canAvoidOrphan = linesOnCurrentPage >= minLinesOnPage;

      if (needsPageBreak && !canAvoidOrphan) {
        // Move whole paragraph to next page to avoid orphan (only 1-2 lines would fit)
        pdf.addPage();
        yPosition = margin;
      }

      if (needsPageBreak && canAvoidOrphan) {
        // Determine split point: ensure at least minLinesOnPage carry over to avoid widow
        const linesToCarryOver = lines.length - linesOnCurrentPage;
        let splitAt = linesOnCurrentPage;

        // If fewer than 3 lines would carry over, adjust split point to ensure 3 carry over
        if (linesToCarryOver < minLinesOnPage && lines.length >= minLinesOnPage) {
          splitAt = lines.length - minLinesOnPage;
        }

        // Render lines that fit on current page
        for (let i = 0; i < splitAt; i++) {
          pdf.text(lines[i], margin, yPosition + (i * lineHeight));
        }

        // Start new page for remaining lines
        pdf.addPage();
        yPosition = margin;

        // Render remaining lines on new page
        const remainingLines = lines.slice(splitAt);
        remainingLines.forEach((line: string, lineIndex: number) => {
          pdf.text(line, margin, yPosition + (lineIndex * lineHeight));
        });
        yPosition += remainingLines.length * lineHeight;
      } else {
        // Render paragraph normally (either fits or was moved to new page)
        lines.forEach((line: string, lineIndex: number) => {
          pdf.text(line, margin, yPosition + (lineIndex * lineHeight));
        });
        yPosition += paragraphHeight;
      }

      // Add spacing between paragraphs (not after last)
      if (index < paragraphs.length - 1) {
        yPosition += 5; // 5mm between paragraphs
      }
    });

    // Force page break after narrative so Themes starts on a new page
    pdf.addPage();
    yPosition = margin;
  }

  // ==========================================================================
  // THEMES - matches tab order position 2
  // ==========================================================================
  if (report.themes && report.themes.length > 0) {
    checkPageBreak(30);

    pdf.setFontSize(16);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(0, 163, 225); // Sonance Blue "The Beam"
    pdf.text('Themes', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont(fontFamily, 'normal');

    report.themes.forEach((theme, idx) => {
      checkPageBreak(25);

      // Sentiment badge configuration
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

      // Fixed position where all sentiment badges start (left-aligned)
      const badgeStartX = pageWidth - margin - 30;
      const titleStartX = margin + 5;
      const gapBetweenTitleAndBadge = 5;

      // Theme title with hanging indent for wrapped lines
      pdf.setFont(fontFamily, 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);

      // Render the number prefix and calculate its width for hanging indent
      const numberPrefix = `${idx + 1}. `;
      const numberWidth = pdf.getTextWidth(numberPrefix);
      const textStartX = titleStartX + numberWidth; // Where theme text begins (after number)
      const maxThemeWidth = badgeStartX - textStartX - gapBetweenTitleAndBadge;

      // Wrap the theme name (without number) to fit within available space
      const themeLines = pdf.splitTextToSize(theme.theme, maxThemeWidth);
      const titleLineHeight = 10 * 0.35 * 1.4; // fontSize * factor * line spacing

      // Render number prefix on first line
      pdf.text(numberPrefix, titleStartX, yPosition);

      // Render theme text lines with hanging indent
      themeLines.forEach((line: string, lineIdx: number) => {
        pdf.text(line, textStartX, yPosition + (lineIdx * titleLineHeight));
      });

      // Sentiment badge on first line at fixed position
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(label, badgeStartX, yPosition);
      pdf.setTextColor(0, 0, 0);

      // Move yPosition past title lines with consistent 6mm gap before evidence
      // (numLines - 1) accounts for lines after the first, then +6 for the standard gap
      yPosition += ((themeLines.length - 1) * titleLineHeight) + 6;

      // Supporting evidence (first 2)
      if (theme.supporting_evidence && theme.supporting_evidence.length > 0) {
        pdf.setFont(fontFamily, 'normal');
        pdf.setFontSize(9);
        theme.supporting_evidence.forEach(evidence => {
          checkPageBreak(15);
          const height = addWrappedText(getStatementText(evidence), margin + 8, yPosition, contentWidth - 8, 9);
          yPosition += height + 3;
        });
      }

      yPosition += 3;
    });

    yPosition += 10; // Extra spacing before next section
  }

  // ==========================================================================
  // STRENGTHS - matches tab order position 3
  // ==========================================================================

  if (report.overall_strengths && report.overall_strengths.length > 0) {
    checkPageBreak(30);

    pdf.setFontSize(16);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(0, 163, 225); // Sonance Blue "The Beam"
    pdf.text('Strengths', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    pdf.setFontSize(10);

    report.overall_strengths.forEach((strength, idx) => {
      checkPageBreak(15);
      // Render bullet in bold black
      pdf.setFont(fontFamily, 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('•', margin + 5, yPosition);
      // Render text in normal black
      pdf.setFont(fontFamily, 'normal');
      const height = addWrappedText(getStatementText(strength), margin + 10, yPosition, contentWidth - 10, 10);
      yPosition += height + 4;
    });

    yPosition += 12; // Extra spacing before next section
  }

  // ==========================================================================
  // DEVELOPMENT AREAS - matches tab order position 4
  // ==========================================================================
  if (report.development_areas && report.development_areas.length > 0) {
    checkPageBreak(30);

    pdf.setFontSize(16);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(0, 163, 225); // Sonance Blue "The Beam"
    pdf.text('Development Areas', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    pdf.setFontSize(10);

    report.development_areas.forEach((area, idx) => {
      checkPageBreak(15);
      // Render bullet in bold black
      pdf.setFont(fontFamily, 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('•', margin + 5, yPosition);
      // Render text in normal black
      pdf.setFont(fontFamily, 'normal');
      const height = addWrappedText(getStatementText(area), margin + 10, yPosition, contentWidth - 10, 10);
      yPosition += height + 4;
    });

    yPosition += 12; // Extra spacing before next section
  }

  // ==========================================================================
  // RECOMMENDED ACTIONS - matches tab order position 5
  // ==========================================================================
  if (report.recommendations && report.recommendations.length > 0) {
    checkPageBreak(30);

    pdf.setFontSize(16);
    pdf.setFont(fontFamily, 'normal');
    pdf.setTextColor(0, 163, 225); // Sonance Blue "The Beam"
    pdf.text('Recommended Actions', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    pdf.setFontSize(10);

    report.recommendations.forEach((rec, idx) => {
      checkPageBreak(15);
      // Render number in bold black
      pdf.setFont(fontFamily, 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${idx + 1}.`, margin + 5, yPosition);
      // Render text in normal black
      pdf.setFont(fontFamily, 'normal');
      const height = addWrappedText(getStatementText(rec), margin + 12, yPosition, contentWidth - 12, 10);
      yPosition += height + 4;
    });

    yPosition += 12; // Extra spacing before next section
  }

  // ==========================================================================
  // CONSENSUS & OUTLIERS - matches tab order position 6 (conditional, sponsor/admin only)
  // ==========================================================================
  const hasConsensus = report.consensus_areas && report.consensus_areas.length > 0;
  const hasVaried = report.varied_by_relationship && report.varied_by_relationship.length > 0;
  const hasOutliers = report.outliers && report.outliers.length > 0;
  const hasOldOutliers = report.outlier_opinions && report.outlier_opinions.length > 0;
  const hasAnyGroupAnalysis = hasConsensus || hasVaried || hasOutliers || hasOldOutliers;

  if (hasAnyGroupAnalysis) {
    checkPageBreak(60);

    // Get subject's first name for labels
    const subjectFirstName = report.employee_name?.split(' ')[0] || 'Subject';

    // Add divider and notice before sponsor/admin-only sections
    pdf.setDrawColor(251, 191, 36); // Amber-400
    pdf.setLineWidth(1);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Notice text - matches web UI wording
    pdf.setFontSize(9);
    pdf.setFont(fontFamily, 'bold');
    pdf.setTextColor(180, 83, 9); // Amber-700

    const line1 = 'Sponsor/Admin Only Section';
    const line2 = `This group-level analysis is not visible to ${subjectFirstName}.`;

    pdf.text(line1, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    pdf.setFont(fontFamily, 'normal');
    pdf.text(line2, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    const line3 = 'Only survey sponsors and administrators can see how different reviewer groups perceive the subject.';
    pdf.setFontSize(8);
    pdf.text(line3, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    pdf.setDrawColor(251, 191, 36); // Amber-400
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;

    // Section 1: Strong Consensus
    if (hasConsensus) {
      pdf.setFontSize(14);
      pdf.setFont(fontFamily, 'bold');
      pdf.setTextColor(34, 197, 94); // Green-500
      pdf.text('Strong Consensus', margin, yPosition);
      yPosition += 6;


      pdf.setFontSize(9);
      pdf.setFont(fontFamily, 'normal');
      pdf.setTextColor(0, 0, 0);

      report.consensus_areas!.forEach((area: any) => {
        checkPageBreak(15);
        const text = getStatementText(area);
        const height = addWrappedText(`• ${text}`, margin + 5, yPosition, contentWidth - 10, 9);
        yPosition += height + 1;

        // Show agreeing groups if available (v2 format)
        if (area.groups_agreeing && area.groups_agreeing.length > 0) {
          pdf.setFontSize(8);
          pdf.setFont(fontFamily, 'italic');
          pdf.setTextColor(100, 100, 100);
          const groupsText = area.groups_agreeing.map((g: string) => getShortGroupLabelForPDF(g)).join(', ');
          pdf.text(`   [${groupsText}]`, margin + 5, yPosition);
          yPosition += 4;
          pdf.setFont(fontFamily, 'normal');
          pdf.setTextColor(0, 0, 0);
        }
        yPosition += 2;
      });

      yPosition += 5;
    }

    // Section 2: Varied by Relationship
    if (hasVaried) {
      checkPageBreak(30);

      pdf.setFontSize(14);
      pdf.setFont(fontFamily, 'bold');
      pdf.setTextColor(99, 102, 241); // Indigo-500
      pdf.text('Varied by Relationship', margin, yPosition);
      yPosition += 6;


      report.varied_by_relationship!.forEach((item: VariedByRelationship) => {
        checkPageBreak(25);

        // Topic header - bullet point, bold, normal capitalization
        pdf.setFontSize(10);
        pdf.setFont(fontFamily, 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`• ${item.topic}`, margin + 5, yPosition);
        yPosition += 7;

        // Perspectives
        pdf.setFontSize(9);
        pdf.setFont(fontFamily, 'normal');

        item.perspectives?.forEach((perspective: VariedPerspective) => {
          checkPageBreak(12);

          // Group label
          pdf.setFont(fontFamily, 'bold');
          pdf.setTextColor(99, 102, 241); // Indigo-500
          const groupLabel = getShortGroupLabelForPDF(perspective.group);
          pdf.text(`${groupLabel}:`, margin + 8, yPosition);

          // Perspective text
          pdf.setFont(fontFamily, 'normal');
          pdf.setTextColor(0, 0, 0);
          const viewText = `"${perspective.view}"`;
          const height = addWrappedText(viewText, margin + 45, yPosition - 3, contentWidth - 50, 9);
          yPosition += Math.max(height, 5) + 2;
        });

        yPosition += 4;
      });

      yPosition += 3;
    }

    // Section 3: Outliers
    if (hasOutliers || hasOldOutliers) {
      checkPageBreak(25);

      pdf.setFontSize(14);
      pdf.setFont(fontFamily, 'bold');
      pdf.setTextColor(245, 158, 11); // Amber-500
      pdf.text('Outliers', margin, yPosition);
      yPosition += 6;


      pdf.setFontSize(9);
      pdf.setFont(fontFamily, 'normal');
      pdf.setTextColor(0, 0, 0);

      // New format outliers
      if (hasOutliers) {
        report.outliers!.forEach((outlier: OutlierV2) => {
          checkPageBreak(10);
          const height = addWrappedText(`• ${outlier.text}`, margin + 5, yPosition, contentWidth - 10, 9);
          yPosition += height + 2;
        });
      }
      // Old format outlier_opinions (backward compatibility)
      else if (hasOldOutliers) {
        report.outlier_opinions!.forEach((opinion: any) => {
          checkPageBreak(10);
          const height = addWrappedText(`• ${getStatementText(opinion)}`, margin + 5, yPosition, contentWidth - 10, 9);
          yPosition += height + 2;
        });
      }
    }
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

  // Generate filename - use employeeName variable from earlier (already extracted from employee_name or survey_name)
  const subjectName = employeeName || 'Report';
  const sponsorTag = suffix === 'FULL' ? ' (SPONSOR ONLY)' : '';
  const filename = `360 Feedback${sponsorTag} - ${subjectName}.pdf`;

  // Save PDF
  pdf.save(filename);

  return filename;
}
