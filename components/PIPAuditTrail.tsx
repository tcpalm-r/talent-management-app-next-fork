import { useState, useMemo } from 'react';
import { Clock, FileText, CheckCircle, Calendar, AlertTriangle, Download, ChevronDown, ChevronRight } from 'lucide-react';
import type { PerformanceImprovementPlan, PIPExpectation, PIPCheckIn, PIPMilestoneReview } from '../types';
import { generateAuditTrail, formatAuditTrailDocument, type AuditEntry } from '../lib/pipDocumentGenerator';

interface PIPAuditTrailProps {
  pip: PerformanceImprovementPlan;
  expectations: PIPExpectation[];
  checkIns: PIPCheckIn[];
  milestoneReviews: PIPMilestoneReview[];
  employeeName: string;
}

export default function PIPAuditTrail({
  pip,
  expectations,
  checkIns,
  milestoneReviews,
  employeeName,
}: PIPAuditTrailProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const auditEntries = useMemo(() => {
    return generateAuditTrail(pip, expectations, checkIns, milestoneReviews);
  }, [pip, expectations, checkIns, milestoneReviews]);

  const handleExport = () => {
    const document = formatAuditTrailDocument(auditEntries, pip, {
      id: pip.employee_id,
      name: employeeName,
      title: '',
    } as any);

    // Create download
    const blob = new Blob([document], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PIP_Audit_Trail_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getEntryIcon = (type: AuditEntry['type']) => {
    switch (type) {
      case 'pip_created':
        return <FileText className="w-4 h-4 text-red-600" />;
      case 'check_in':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'milestone_review':
        return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'expectation_update':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'outcome':
        return <AlertTriangle className="w-4 h-4 text-gray-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEntryColor = (type: AuditEntry['type']) => {
    switch (type) {
      case 'pip_created':
        return 'border-red-200 bg-red-50';
      case 'check_in':
        return 'border-blue-200 bg-blue-50';
      case 'milestone_review':
        return 'border-purple-200 bg-purple-50';
      case 'expectation_update':
        return 'border-green-200 bg-green-50';
      case 'outcome':
        return 'border-gray-200 bg-gray-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-gray-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Complete Audit Trail</h3>
            <p className="text-sm text-gray-600">
              {auditEntries.length} documented interaction{auditEntries.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExport();
            }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* Entries */}
            <div className="space-y-4">
              {auditEntries.map((entry, index) => (
                <div key={index} className="relative pl-12">
                  {/* Icon */}
                  <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                    {getEntryIcon(entry.type)}
                  </div>

                  {/* Content */}
                  <div className={`rounded-lg border p-3 ${getEntryColor(entry.type)}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase">
                          {entry.type.replace('_', ' ')}
                        </p>
                        <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    {entry.participants.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        <strong>Participants:</strong> {entry.participants.join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {entry.documentation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">
                {checkIns.length}
              </div>
              <div className="text-xs text-gray-600">Check-Ins</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">
                {milestoneReviews.length}
              </div>
              <div className="text-xs text-gray-600">Reviews</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">
                {auditEntries.length}
              </div>
              <div className="text-xs text-gray-600">Total Events</div>
            </div>
          </div>

          {/* Export Note */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              <strong>Legal Note:</strong> This audit trail demonstrates proper process was followed. 
              Export and attach to personnel file for legal compliance. Retain for minimum 3 years after employment ends.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

