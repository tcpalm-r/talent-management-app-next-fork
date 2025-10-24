import { useState, useMemo } from 'react';
import { FileText, ChevronDown, ChevronRight, Shield, AlertTriangle, CheckCircle, Download, Mail } from 'lucide-react';
import type { PerformanceImprovementPlan, PIPExpectation, PIPCheckIn, PIPMilestoneReview } from '../types';

interface PIPDocumentationAssistantProps {
  pip: PerformanceImprovementPlan;
  expectations: PIPExpectation[];
  checkIns: PIPCheckIn[];
  milestoneReviews: PIPMilestoneReview[];
  employeeName: string;
}

interface DocumentationGap {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  description: string;
  howToFix: string;
}

export default function PIPDocumentationAssistant({
  pip,
  expectations,
  checkIns,
  milestoneReviews,
  employeeName,
}: PIPDocumentationAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate documentation completeness
  const analysis = useMemo(() => {
    const gaps: DocumentationGap[] = [];
    let score = 100;

    // Check if PIP letter has been delivered
    if (!pip.start_date) {
      gaps.push({
        id: 'no-start-date',
        severity: 'critical',
        category: 'PIP Letter',
        description: 'No start date documented',
        howToFix: 'Set the PIP start date and document delivery to employee',
      });
      score -= 15;
    }

    // Check for reason documentation
    if (!pip.reason_for_pip || pip.reason_for_pip.length < 50) {
      gaps.push({
        id: 'weak-reason',
        severity: 'critical',
        category: 'Justification',
        description: 'Reason for PIP is missing or too brief',
        howToFix: 'Document specific performance issues with dates, examples, and metrics',
      });
      score -= 15;
    }

    // Check consequences are documented
    if (!pip.consequences) {
      gaps.push({
        id: 'no-consequences',
        severity: 'critical',
        category: 'Legal Language',
        description: 'Consequences not documented',
        howToFix: 'Add standard consequence language to PIP letter',
      });
      score -= 10;
    }

    // Check for expectations
    if (expectations.length === 0) {
      gaps.push({
        id: 'no-expectations',
        severity: 'critical',
        category: 'Expectations',
        description: 'No expectations defined',
        howToFix: 'Add at least 3-5 specific, measurable expectations',
      });
      score -= 20;
    }

    // Check check-in frequency
    const startDate = new Date(pip.start_date);
    const today = new Date();
    const daysInPIP = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const expectedCheckIns = Math.floor(daysInPIP / 7); // Weekly minimum
    const actualCheckIns = checkIns.length;

    if (daysInPIP > 7 && actualCheckIns < expectedCheckIns) {
      gaps.push({
        id: 'insufficient-checkins',
        severity: 'warning',
        category: 'Check-Ins',
        description: `Only ${actualCheckIns} check-ins for ${daysInPIP} days (expected ${expectedCheckIns})`,
        howToFix: 'Schedule and document weekly check-ins. Gaps in documentation weaken legal position.',
      });
      score -= 10;
    }

    // Check for recent check-in
    if (checkIns.length > 0) {
      const lastCheckIn = checkIns.sort((a, b) => 
        new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
      )[0];
      const daysSinceLastCheckIn = Math.floor(
        (today.getTime() - new Date(lastCheckIn.check_in_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastCheckIn > 10) {
        gaps.push({
          id: 'overdue-checkin',
          severity: 'critical',
          category: 'Check-Ins',
          description: `Last check-in was ${daysSinceLastCheckIn} days ago (OVERDUE)`,
          howToFix: 'Schedule urgent check-in today. Long gaps look like abandonment to courts.',
        });
        score -= 15;
      }
    } else if (daysInPIP > 7) {
      gaps.push({
        id: 'no-checkins',
        severity: 'critical',
        category: 'Check-Ins',
        description: 'No check-ins documented',
        howToFix: 'Begin weekly check-ins immediately and document all conversations',
      });
      score -= 20;
    }

    // Check milestone reviews
    if (daysInPIP > 32 && !milestoneReviews.some(r => r.milestone === '30_day')) {
      gaps.push({
        id: 'missing-30day',
        severity: 'critical',
        category: 'Milestone Reviews',
        description: '30-day review not completed (overdue)',
        howToFix: 'Complete formal 30-day review immediately with HR present',
      });
      score -= 15;
    }

    if (daysInPIP > 62 && !milestoneReviews.some(r => r.milestone === '60_day')) {
      gaps.push({
        id: 'missing-60day',
        severity: 'critical',
        category: 'Milestone Reviews',
        description: '60-day review not completed (overdue)',
        howToFix: 'Complete formal 60-day review immediately with HR present',
      });
      score -= 15;
    }

    // Check for employee acknowledgment (simulate with created_at being recent enough)
    const pipAge = Math.floor((today.getTime() - new Date(pip.created_at).getTime()) / (1000 * 60 * 60 * 24));
    if (pipAge > 3) {
      gaps.push({
        id: 'no-signature',
        severity: 'warning',
        category: 'Employee Signature',
        description: 'Employee signature/acknowledgment not documented',
        howToFix: 'Ensure employee signs PIP letter. If they refuse, document the refusal with witness.',
      });
      score -= 5;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      gaps: gaps.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      criticalCount: gaps.filter(g => g.severity === 'critical').length,
      warningCount: gaps.filter(g => g.severity === 'warning').length,
    };
  }, [pip, expectations, checkIns, milestoneReviews]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Strong';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Weak';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Documentation Assistant</h3>
            <p className={`text-sm font-medium ${getScoreColor(analysis.score)}`}>
              Legal Protection: {analysis.score}% ({getScoreLabel(analysis.score)})
            </p>
          </div>
        </div>
        {analysis.criticalCount > 0 && (
          <div className="flex items-center gap-2 mr-2">
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
              {analysis.criticalCount} critical
            </span>
          </div>
        )}
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Score Overview */}
          <div className={`rounded-lg p-4 ${
            analysis.score >= 75 ? 'bg-green-50 border border-green-200' : 
            analysis.score >= 60 ? 'bg-amber-50 border border-amber-200' : 
            'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${getScoreColor(analysis.score)}`} />
                <span className={`text-lg font-bold ${getScoreColor(analysis.score)}`}>
                  {analysis.score}%
                </span>
                <span className="text-sm text-gray-600">Legal Protection</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  analysis.score >= 75 ? 'bg-green-600' : 
                  analysis.score >= 60 ? 'bg-amber-600' : 
                  'bg-red-600'
                }`}
                style={{ width: `${analysis.score}%` }}
              />
            </div>
            {analysis.score < 75 && (
              <p className="text-sm text-gray-700 mt-2">
                {analysis.criticalCount > 0 && (
                  <span className="font-medium text-red-700">
                    {analysis.criticalCount} critical gap{analysis.criticalCount !== 1 ? 's' : ''} must be fixed.
                  </span>
                )}
                {analysis.warningCount > 0 && analysis.criticalCount === 0 && (
                  <span className="font-medium text-amber-700">
                    {analysis.warningCount} warning{analysis.warningCount !== 1 ? 's' : ''} should be addressed.
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Documentation Gaps */}
          {analysis.gaps.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Documentation Gaps</h4>
              <div className="space-y-2">
                {analysis.gaps.map(gap => (
                  <div
                    key={gap.id}
                    className={`p-3 rounded-lg border ${
                      gap.severity === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : gap.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {gap.severity === 'critical' ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-600 uppercase">
                            {gap.category}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            gap.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            gap.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {gap.severity}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {gap.description}
                        </p>
                        <p className="text-xs text-gray-600">
                          <strong>Fix:</strong> {gap.howToFix}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Actions */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-semibold text-gray-900 mb-3">Generate Documents</h4>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">Generate PIP Letter (PDF)</p>
                    <p className="text-xs text-gray-600">Formal letter with all expectations</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-blue-600" />
              </button>

              <button className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-purple-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">Email PIP to Employee</p>
                    <p className="text-xs text-gray-600">Send formal notice with tracking</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-purple-600" />
              </button>

              <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">Export Complete Audit Trail</p>
                    <p className="text-xs text-gray-600">All interactions for legal review</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Checklist Status */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-semibold text-gray-900 mb-3">Documentation Checklist</h4>
            <div className="space-y-2">
              <ChecklistItem
                checked={!!pip.reason_for_pip && pip.reason_for_pip.length >= 50}
                label="Performance issues documented with specifics"
              />
              <ChecklistItem
                checked={expectations.length >= 3}
                label="Clear, measurable expectations defined (3+ required)"
              />
              <ChecklistItem
                checked={!!pip.start_date}
                label="PIP letter delivered to employee"
              />
              <ChecklistItem
                checked={!!pip.support_provided}
                label="Support and resources documented"
              />
              <ChecklistItem
                checked={checkIns.length >= Math.floor(Math.max(0, Math.floor((Date.now() - new Date(pip.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7))))}
                label={`Weekly check-ins documented (${checkIns.length} completed)`}
              />
              <ChecklistItem
                checked={milestoneReviews.some(r => r.milestone === '30_day') || Math.floor((Date.now() - new Date(pip.start_date).getTime()) / (1000 * 60 * 60 * 24)) < 30}
                label="30-day milestone review completed"
              />
              <ChecklistItem
                checked={milestoneReviews.some(r => r.milestone === '60_day') || Math.floor((Date.now() - new Date(pip.start_date).getTime()) / (1000 * 60 * 60 * 24)) < 60}
                label="60-day milestone review completed"
              />
              <ChecklistItem
                checked={!!pip.consequences}
                label="Consequences clearly stated"
              />
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">📚 Documentation Best Practices</h4>
            <ul className="space-y-1 text-xs text-blue-900">
              <li>• Document everything within 24 hours</li>
              <li>• Use specific examples with dates</li>
              <li>• Include employee's comments verbatim</li>
              <li>• Note what support was offered</li>
              <li>• Keep email trail of all communications</li>
              <li>• Have HR review before major decisions</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChecklistItemProps {
  checked: boolean;
  label: string;
}

function ChecklistItem({ checked, label }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
      )}
      <span className={checked ? 'text-gray-900' : 'text-gray-600'}>
        {label}
      </span>
    </div>
  );
}

