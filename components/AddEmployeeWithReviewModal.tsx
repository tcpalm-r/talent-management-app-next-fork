import { useState } from 'react';
import { X, User, Mail, Briefcase, MapPin, FileText, Sparkles, Upload, Loader } from 'lucide-react';
import type { Department, Employee, Performance, Potential } from '../types';
import { analyzePerformanceReview } from '../lib/reviewAnalyzer';

interface AddEmployeeWithReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  organizationId: string;
  onEmployeeCreated: (
    employee: Partial<Employee>,
    assessment: { performance: Performance; potential: Potential; boxKey: string },
    developmentPlan: any
  ) => void;
}

export default function AddEmployeeWithReviewModal({
  isOpen,
  onClose,
  departments,
  organizationId,
  onEmployeeCreated
}: AddEmployeeWithReviewModalProps) {
  // Employee Info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [location, setLocation] = useState('');
  const [managerName, setManagerName] = useState('');

  // Review Text
  const [reviewText, setReviewText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState<'info' | 'review'>('info');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setEmail('');
    setTitle('');
    setDepartmentId('');
    setLocation('');
    setManagerName('');
    setReviewText('');
    setStep('info');
    setError(null);
  };

  const handleNext = () => {
    if (!name.trim()) {
      setError('Employee name is required');
      return;
    }
    setError(null);
    setStep('review');
  };

  const handleAnalyzeAndCreate = async () => {
    if (!reviewText.trim()) {
      setError('Please paste the performance review text');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Analyze the review with AI
      const analysis = await analyzePerformanceReview(reviewText, name);

      // Create employee object
      const newEmployee: Partial<Employee> = {
        name,
        email: email || null,
        title: title || null,
        department_id: departmentId || null,
        location: location || null,
        manager_name: managerName || null,
        organization_id: organizationId,
        employee_id: `E${Date.now()}`
      };

      // Create assessment
      const assessment = {
        performance: analysis.suggestedPlacement.performance,
        potential: analysis.suggestedPlacement.potential,
        boxKey: `${analysis.suggestedPlacement.performance === 'high' ? '3' : analysis.suggestedPlacement.performance === 'medium' ? '2' : '1'}-${analysis.suggestedPlacement.potential === 'high' ? '3' : analysis.suggestedPlacement.potential === 'medium' ? '2' : '1'}`
      };

      // Pass to parent component
      onEmployeeCreated(newEmployee, assessment, analysis.developmentPlan);

      // Reset and close
      resetForm();
      onClose();
    } catch (err) {
      console.error('Error analyzing review:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze review. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSkipReview = () => {
    // Create employee without review analysis - they'll be unassessed
    const newEmployee: Partial<Employee> = {
      name,
      email: email || null,
      title: title || null,
      department_id: departmentId || null,
      location: location || null,
      manager_name: managerName || null,
      organization_id: organizationId,
      employee_id: `E${Date.now()}`
    };

    // No assessment - employee will appear in unassigned
    onEmployeeCreated(newEmployee, null as any, null);

    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Add New Employee</h2>
              <p className="text-blue-100 text-sm">
                {step === 'info' ? 'Step 1: Basic Information' : 'Step 2: Performance Review (Optional)'}
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center px-6 pt-4">
          <div className={`flex items-center ${step === 'info' ? 'text-blue-600' : 'text-green-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
              step === 'info' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
            }`}>
              {step === 'review' ? '✓' : '1'}
            </div>
            <span className="ml-2 text-sm font-semibold">Employee Info</span>
          </div>
          <div className="flex-1 h-1 bg-gray-200 mx-4">
            <div className={`h-full transition-all duration-300 ${step === 'review' ? 'bg-blue-600 w-full' : 'w-0'}`} />
          </div>
          <div className={`flex items-center ${step === 'review' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
              step === 'review' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
            }`}>
              2
            </div>
            <span className="ml-2 text-sm font-semibold">Review Analysis</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {step === 'info' && (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Employee Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sarah Johnson"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., sarah.johnson@company.com"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Briefcase className="w-4 h-4 inline mr-1" />
                  Job Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Senior Software Engineer"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select department...</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location and Manager */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select location...</option>
                    <option value="San Clemente">San Clemente</option>
                    <option value="Minden">Minden</option>
                    <option value="Fontana">Fontana</option>
                    <option value="China office">China office</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="e.g., John Smith"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Info Box */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Sparkles className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-purple-900 mb-1">AI-Powered Review Analysis</h3>
                    <p className="text-sm text-purple-700">
                      Paste the employee's performance review and Claude will:
                    </p>
                    <ul className="text-sm text-purple-700 mt-2 space-y-1 list-disc list-inside">
                      <li>Assess their performance and potential</li>
                      <li>Place them in the appropriate 9-box cell</li>
                      <li>Generate a personalized development plan</li>
                      <li>Create specific action items with deadlines</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Review Text Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Performance Review Text (Optional)
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Paste the performance review here...&#10;&#10;Example:&#10;Sarah has consistently exceeded expectations this year. She delivered 5 major projects on time and mentored 3 junior engineers. Her technical skills are exceptional, and she's demonstrated strong leadership potential. Areas for growth include strategic thinking and executive communication. Recommend for promotion track."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                  rows={12}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Tip: The more detailed the review, the better the analysis. Include strengths, areas for improvement, and future potential.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            {step === 'info' ? (
              <>
                <div className="text-sm text-gray-600">
                  * Required fields
                </div>
                <button
                  onClick={handleNext}
                  disabled={!name.trim()}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  Next: Add Review →
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep('info')}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ← Back
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSkipReview}
                    disabled={isAnalyzing}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    Skip Review
                  </button>
                  <button
                    onClick={handleAnalyzeAndCreate}
                    disabled={isAnalyzing || !reviewText.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center space-x-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Analyzing Review...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Analyze & Create</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
