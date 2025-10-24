import { Edit, FileText, List, Tag, Award, AlertCircle, Plus } from 'lucide-react';
import type { Employee } from '../types';
import { getSkillCategoryColor } from '../lib/skillsLibrary';
import { EmployeeNameLink } from './unified';

interface JobDescriptionViewerProps {
  employee: Employee;
  onEdit: () => void;
  canEdit?: boolean;
}

export default function JobDescriptionViewer({
  employee,
  onEdit,
  canEdit = true,
}: JobDescriptionViewerProps) {
  const hasJobDescription = employee.job_description ||
    (employee.key_responsibilities && employee.key_responsibilities.length > 0) ||
    (employee.required_skills && employee.required_skills.length > 0);

  if (!hasJobDescription) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Job Description</h3>
        <p className="text-sm text-gray-600 mb-6">
          Add a job description to define role expectations and required skills.
        </p>
        {canEdit && (
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Job Description
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{employee.title || 'Role'}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {employee.department?.name && `${employee.department.name} • `}
            <EmployeeNameLink
              employee={employee}
              className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
            />
          </p>
        </div>
        {canEdit && (
          <button
            onClick={onEdit}
            className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* Job Description */}
      {employee.job_description && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Job Description
            </h4>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {employee.job_description}
          </p>
        </div>
      )}

      {/* Key Responsibilities */}
      {employee.key_responsibilities && employee.key_responsibilities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <List className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Key Responsibilities
            </h4>
          </div>
          <ul className="space-y-2">
            {employee.key_responsibilities.map((resp, index) => (
              <li key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <p className="flex-1 text-sm text-gray-700 leading-relaxed">{resp}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Required Skills */}
      {employee.required_skills && employee.required_skills.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Required Skills
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {employee.required_skills.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-sm font-medium"
              >
                <Tag className="w-3.5 h-3.5" />
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preferred Qualifications */}
      {employee.preferred_qualifications && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Preferred Qualifications
            </h4>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed p-3 bg-amber-50 border border-amber-200 rounded-lg">
            {employee.preferred_qualifications}
          </p>
        </div>
      )}

      {/* Missing Fields Warning */}
      {canEdit && (!employee.job_description || !employee.key_responsibilities || employee.key_responsibilities.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-900 mb-1">
              Incomplete Job Description
            </div>
            <p className="text-xs text-amber-800">
              Consider adding {!employee.job_description && 'a job description, '}
              {(!employee.key_responsibilities || employee.key_responsibilities.length === 0) && 'key responsibilities, '}
              to provide clear role expectations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
