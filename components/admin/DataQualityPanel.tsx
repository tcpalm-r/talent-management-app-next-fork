import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import type { Employee, Department } from '../../types';

interface DataQualityPanelProps {
  employees: Employee[];
  departments: Department[];
  onFixIssue?: (employeeId: string, issueType: string) => void;
}

interface QualityIssue {
  id: string;
  type: 'missing_assessment' | 'missing_email' | 'missing_department' | 'missing_title' | 'stale_data' | 'duplicate_name' | 'duplicate_email';
  severity: 'low' | 'medium' | 'high' | 'critical';
  employeeId: string;
  employeeName: string;
  description: string;
  suggestedAction: string;
  relatedEmployeeIds?: string[];
}

export default function DataQualityPanel({ employees, departments, onFixIssue }: DataQualityPanelProps) {
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    detectIssues();
  }, [employees]);

  const detectIssues = () => {
    const detectedIssues: QualityIssue[] = [];

    // Track duplicates
    const nameMap = new Map<string, Employee[]>();
    const emailMap = new Map<string, Employee[]>();
    const processedDuplicates = new Set<string>();

    // Build maps for duplicate detection
    employees.forEach(employee => {
      // Track by name (case-insensitive, trimmed)
      const normalizedName = employee.name.toLowerCase().trim();
      if (!nameMap.has(normalizedName)) {
        nameMap.set(normalizedName, []);
      }
      nameMap.get(normalizedName)!.push(employee);

      // Track by email (case-insensitive, trimmed, only if email exists)
      if (employee.email && employee.email.trim() !== '') {
        const normalizedEmail = employee.email.toLowerCase().trim();
        if (!emailMap.has(normalizedEmail)) {
          emailMap.set(normalizedEmail, []);
        }
        emailMap.get(normalizedEmail)!.push(employee);
      }
    });

    // Detect duplicate names
    nameMap.forEach((duplicates, name) => {
      if (duplicates.length > 1) {
        const allIds = duplicates.map(e => e.id).sort().join('-');
        if (!processedDuplicates.has(`name-${allIds}`)) {
          processedDuplicates.add(`name-${allIds}`);
          duplicates.forEach(employee => {
            const otherNames = duplicates
              .filter(e => e.id !== employee.id)
              .map(e => e.name)
              .join(', ');
            detectedIssues.push({
              id: `${employee.id}-duplicate-name`,
              type: 'duplicate_name',
              severity: 'high',
              employeeId: employee.id,
              employeeName: employee.name,
              description: `Duplicate name found: also exists as ${otherNames}`,
              suggestedAction: 'Review and merge duplicate records or update name if different person',
              relatedEmployeeIds: duplicates.filter(e => e.id !== employee.id).map(e => e.id),
            });
          });
        }
      }
    });

    // Detect duplicate emails
    emailMap.forEach((duplicates, email) => {
      if (duplicates.length > 1) {
        const allIds = duplicates.map(e => e.id).sort().join('-');
        if (!processedDuplicates.has(`email-${allIds}`)) {
          processedDuplicates.add(`email-${allIds}`);
          duplicates.forEach(employee => {
            const otherNames = duplicates
              .filter(e => e.id !== employee.id)
              .map(e => e.name)
              .join(', ');
            detectedIssues.push({
              id: `${employee.id}-duplicate-email`,
              type: 'duplicate_email',
              severity: 'critical',
              employeeId: employee.id,
              employeeName: employee.name,
              description: `Duplicate email (${email}): also used by ${otherNames}`,
              suggestedAction: 'Merge duplicate records or update email - emails must be unique',
              relatedEmployeeIds: duplicates.filter(e => e.id !== employee.id).map(e => e.id),
            });
          });
        }
      }
    });

    employees.forEach(employee => {
      // Missing assessment
      if (!employee.assessment || !employee.assessment.performance || !employee.assessment.potential) {
        detectedIssues.push({
          id: `${employee.id}-assessment`,
          type: 'missing_assessment',
          severity: 'medium',
          employeeId: employee.id,
          employeeName: employee.name,
          description: 'No performance assessment',
          suggestedAction: 'Add assessment via 9-Box Grid or employee detail page',
        });
      }

      // Missing email
      if (!employee.email || employee.email.trim() === '') {
        detectedIssues.push({
          id: `${employee.id}-email`,
          type: 'missing_email',
          severity: 'low',
          employeeId: employee.id,
          employeeName: employee.name,
          description: 'No email address',
          suggestedAction: 'Update employee profile with email address',
        });
      }

      // Missing department
      if (!employee.department_id) {
        detectedIssues.push({
          id: `${employee.id}-department`,
          type: 'missing_department',
          severity: 'medium',
          employeeId: employee.id,
          employeeName: employee.name,
          description: 'No department assigned',
          suggestedAction: 'Assign employee to a department',
        });
      }

      // Missing title
      if (!employee.title || employee.title.trim() === '') {
        detectedIssues.push({
          id: `${employee.id}-title`,
          type: 'missing_title',
          severity: 'low',
          employeeId: employee.id,
          employeeName: employee.name,
          description: 'No job title',
          suggestedAction: 'Add job title to employee profile',
        });
      }

      // Stale assessment (over 365 days old)
      if (employee.assessment?.assessed_at) {
        const assessedDate = new Date(employee.assessment.assessed_at);
        const daysSinceAssessment = Math.floor((Date.now() - assessedDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceAssessment > 365) {
          detectedIssues.push({
            id: `${employee.id}-stale`,
            type: 'stale_data',
            severity: 'high',
            employeeId: employee.id,
            employeeName: employee.name,
            description: `Assessment is ${daysSinceAssessment} days old`,
            suggestedAction: 'Update assessment - annual reviews recommended',
          });
        }
      }
    });

    setIssues(detectedIssues);
  };

  const filteredIssues = filterSeverity === 'all'
    ? issues
    : issues.filter(issue => issue.severity === filterSeverity);

  const issuesBySeverity = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
  };

  const totalIssues = issues.length;
  const dataQualityScore = employees.length > 0
    ? Math.round(((employees.length - issues.length) / employees.length) * 100)
    : 100;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <Info className="w-4 h-4 text-blue-600" />;
      default:
        return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'high':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Quality Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Data Quality Score</h3>
            <p className="text-sm text-gray-600">Overall completeness and accuracy</p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${
              dataQualityScore >= 90 ? 'text-green-600' :
              dataQualityScore >= 70 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {dataQualityScore}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'} found
            </p>
          </div>
        </div>

        {/* Score Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div
            className={`h-3 rounded-full transition-all ${
              dataQualityScore >= 90 ? 'bg-green-500' :
              dataQualityScore >= 70 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${dataQualityScore}%` }}
          />
        </div>

        {/* Issue Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { severity: 'critical', label: 'Critical', count: issuesBySeverity.critical },
            { severity: 'high', label: 'High', count: issuesBySeverity.high },
            { severity: 'medium', label: 'Medium', count: issuesBySeverity.medium },
            { severity: 'low', label: 'Low', count: issuesBySeverity.low },
          ].map(({ severity, label, count }) => (
            <button
              key={severity}
              onClick={() => setFilterSeverity(filterSeverity === severity ? 'all' : severity)}
              className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                filterSeverity === severity
                  ? getSeverityColor(severity)
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Issues List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Data Quality Issues
            {filterSeverity !== 'all' && (
              <span className="ml-2 text-gray-500">
                ({filteredIssues.length} {filterSeverity})
              </span>
            )}
          </h3>
          {filterSeverity !== 'all' && (
            <button
              onClick={() => setFilterSeverity('all')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredIssues.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">No issues found!</p>
              <p className="text-xs text-gray-500 mt-1">
                {filterSeverity === 'all'
                  ? 'All employee data is complete and accurate'
                  : `No ${filterSeverity} severity issues`}
              </p>
            </div>
          ) : (
            filteredIssues.map(issue => (
              <div key={issue.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(issue.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900">{issue.employeeName}</p>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(issue.severity)}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{issue.description}</p>
                    <p className="text-xs text-gray-500 italic">💡 {issue.suggestedAction}</p>
                  </div>
                  {onFixIssue && (
                    <button
                      onClick={() => onFixIssue(issue.employeeId, issue.type)}
                      className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Fix
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recommendations */}
      {totalIssues > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 mb-2">Recommended Actions</p>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                {issuesBySeverity.critical + issuesBySeverity.high > 0 && (
                  <li>Address critical and high-severity issues immediately</li>
                )}
                {issues.filter(i => i.type === 'missing_assessment').length > 0 && (
                  <li>Schedule assessment reviews for employees missing evaluations</li>
                )}
                {issues.filter(i => i.type === 'stale_data').length > 0 && (
                  <li>Update assessments older than 1 year to maintain accuracy</li>
                )}
                <li>Consider bulk import/update for fixing multiple records</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
