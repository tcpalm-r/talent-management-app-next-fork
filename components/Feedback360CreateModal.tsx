import { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, ChevronDown, ChevronRight, Mail, Users, Calendar, Send, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Employee, Department } from '../types';

interface Feedback360CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  departments: Department[];
  organizationId: string;
  currentUserName: string;
  onSurveyCreated: () => void;
}

interface QuestionTemplate {
  id: string;
  category: string;
  question_text: string;
  response_type: string;
  scale_min: number;
  scale_max: number;
}

interface SelectedQuestion {
  template_id: string;
  question_text: string;
  category: string;
  response_type: string;
  scale_min: number;
  scale_max: number;
  is_required: boolean;
}

interface Reviewer {
  name: string;
  email: string;
  relationship: 'manager' | 'peer' | 'direct_report' | 'cross_functional';
}

export default function Feedback360CreateModal({
  isOpen,
  onClose,
  employees,
  departments,
  organizationId,
  currentUserName,
  onSurveyCreated
}: Feedback360CreateModalProps) {
  const [step, setStep] = useState(1); // 1: Employee, 2: Questions, 3: Reviewers, 4: Review
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [surveyName, setSurveyName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [questionTemplates, setQuestionTemplates] = useState<QuestionTemplate[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadQuestionTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedEmployeeId) {
      const employee = employees.find(e => e.id === selectedEmployeeId);
      if (employee) {
        setSurveyName(`360° Feedback - ${employee.name}`);
      }
    }
  }, [selectedEmployeeId, employees]);

  const loadQuestionTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_360_question_templates')
        .select('*')
        .order('category, question_text');

      if (error) throw error;
      setQuestionTemplates(data || []);
    } catch (error) {
      console.error('Error loading question templates:', error);
    }
  };

  const categories = Array.from(new Set(questionTemplates.map(q => q.category)));

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const addQuestion = (template: QuestionTemplate) => {
    if (!selectedQuestions.find(q => q.template_id === template.id)) {
      setSelectedQuestions([...selectedQuestions, {
        template_id: template.id,
        question_text: template.question_text,
        category: template.category,
        response_type: template.response_type,
        scale_min: template.scale_min,
        scale_max: template.scale_max,
        is_required: true
      }]);
    }
  };

  const removeQuestion = (templateId: string) => {
    setSelectedQuestions(selectedQuestions.filter(q => q.template_id !== templateId));
  };

  const addSuggestedQuestions = (category: string) => {
    const categoryQuestions = questionTemplates.filter(q => q.category === category);
    const suggested = categoryQuestions.slice(0, 3); // Add first 3 questions from category

    suggested.forEach(template => {
      if (!selectedQuestions.find(q => q.template_id === template.id)) {
        addQuestion(template);
      }
    });
  };

  const addReviewer = () => {
    setReviewers([...reviewers, { name: '', email: '', relationship: 'peer' }]);
  };

  const updateReviewer = (index: number, field: keyof Reviewer, value: string) => {
    const updated = [...reviewers];
    updated[index] = { ...updated[index], [field]: value };
    setReviewers(updated);
  };

  const removeReviewer = (index: number) => {
    setReviewers(reviewers.filter((_, i) => i !== index));
  };

  const handleCreateSurvey = async (saveAsDraft: boolean = false) => {
    setLoading(true);
    try {
      // Create survey
      const { data: survey, error: surveyError } = await supabase
        .from('feedback_360_surveys')
        .insert({
          employee_id: selectedEmployeeId,
          survey_name: surveyName,
          status: saveAsDraft ? 'draft' : 'active',
          due_date: dueDate || null,
          created_by: 'current-user'
        })
        .select()
        .single();

      if (surveyError) throw surveyError;

      // Note: Question linking would require question IDs from feedback_360_questions table
      // This is a simplified version - in production, you'd need to:
      // 1. Get or create questions in feedback_360_questions
      // 2. Link them via feedback_360_survey_questions junction table

      // Add reviewers
      if (!saveAsDraft && reviewers.length > 0) {
        const reviewerRecords = reviewers.map(r => ({
          survey_id: survey.id,
          reviewer_name: r.name,
          reviewer_email: r.email,
          relationship: r.relationship,
          access_token: `${Math.random().toString(36).substring(2)}-${Date.now()}`,
          status: 'pending',
          invited_at: new Date().toISOString()
        }));

        const { error: reviewersError } = await supabase
          .from('feedback_360_survey_reviewers')
          .insert(reviewerRecords);

        if (reviewersError) throw reviewersError;
      }

      alert(saveAsDraft
        ? '✅ Survey saved as draft! You can send it later from the dashboard.'
        : `✅ Survey created and sent to ${reviewers.length} reviewers!`
      );

      onSurveyCreated();
      handleClose();
    } catch (error) {
      console.error('Error creating survey:', error);
      alert('Failed to create survey. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedEmployeeId('');
    setSurveyName('');
    setDueDate('');
    setSelectedQuestions([]);
    setReviewers([]);
    setSearchQuery('');
    setExpandedCategories(new Set());
    onClose();
  };

  const filteredTemplates = questionTemplates.filter(q =>
    q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <div>
            <h2 className="text-xl font-bold text-white">Create 360° Feedback Survey</h2>
            <p className="text-blue-100 text-sm mt-0.5">Step {step} of 4</p>
          </div>
          <button onClick={handleClose} className="text-white hover:text-gray-200 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-xs">
            {['Employee', 'Questions', 'Reviewers', 'Review'].map((label, index) => (
              <div key={label} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step > index + 1 ? 'bg-green-500 text-white' :
                  step === index + 1 ? 'bg-blue-600 text-white' :
                  'bg-gray-300 text-gray-600'
                }`}>
                  {step > index + 1 ? '✓' : index + 1}
                </div>
                <span className={`ml-2 font-medium ${step === index + 1 ? 'text-blue-600' : 'text-gray-600'}`}>
                  {label}
                </span>
                {index < 3 && <div className="flex-1 h-1 bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Employee */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Employee for Feedback
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose an employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.title ? `- ${emp.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Survey Name
                </label>
                <input
                  type="text"
                  value={surveyName}
                  onChange={(e) => setSurveyName(e.target.value)}
                  placeholder="e.g., Q1 2025 360° Feedback"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Select Questions */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">💡 Quick Start Tips</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Click "Add Suggested" to quickly add 3 questions from each category</li>
                  <li>• Expand categories to browse all available questions</li>
                  <li>• Aim for 15-25 questions for a comprehensive yet manageable survey</li>
                </ul>
              </div>

              <div className="flex items-center justify-between">
                <div className="relative flex-1 mr-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {selectedQuestions.length} selected
                </div>
              </div>

              {/* Selected Questions */}
              {selectedQuestions.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">Selected Questions ({selectedQuestions.length})</h4>
                  <div className="space-y-2">
                    {selectedQuestions.map((q, index) => (
                      <div key={q.template_id} className="flex items-start bg-white rounded p-3 border border-green-200">
                        <span className="text-xs font-semibold text-green-700 mr-2 mt-0.5">{index + 1}.</span>
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">{q.question_text}</div>
                          <div className="text-xs text-gray-500 mt-1">{q.category}</div>
                        </div>
                        <button
                          onClick={() => removeQuestion(q.template_id)}
                          className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question Library by Category */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Question Library</h4>
                {categories.map(category => {
                  const categoryQuestions = (searchQuery ? filteredTemplates : questionTemplates)
                    .filter(q => q.category === category);

                  if (categoryQuestions.length === 0) return null;

                  const isExpanded = expandedCategories.has(category);

                  return (
                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="flex items-center flex-1 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 mr-2 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 mr-2 text-gray-600" />
                          )}
                          <span className="font-semibold text-gray-900">{category}</span>
                          <span className="ml-2 text-sm text-gray-500">({categoryQuestions.length} questions)</span>
                        </button>
                        <button
                          onClick={() => addSuggestedQuestions(category)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          Add Suggested
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="p-4 space-y-2 bg-white">
                          {categoryQuestions.map(template => {
                            const isSelected = selectedQuestions.find(q => q.template_id === template.id);
                            return (
                              <div
                                key={template.id}
                                className={`flex items-start p-3 rounded border ${
                                  isSelected
                                    ? 'border-green-300 bg-green-50'
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                } transition-colors`}
                              >
                                <div className="flex-1 text-sm text-gray-900">{template.question_text}</div>
                                <button
                                  onClick={() => isSelected ? removeQuestion(template.id) : addQuestion(template)}
                                  className={`ml-3 p-1.5 rounded transition-colors ${
                                    isSelected
                                      ? 'bg-green-600 text-white hover:bg-green-700'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {isSelected ? (
                                    <Trash2 className="w-4 h-4" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Add Reviewers */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">👥 Add Reviewers</h3>
                <p className="text-sm text-blue-700">
                  Add people who will provide feedback on <strong>{selectedEmployee?.name}</strong>.
                  Include managers, peers, direct reports, and cross-functional partners for comprehensive feedback.
                </p>
              </div>

              <button
                onClick={addReviewer}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Reviewer
              </button>

              <div className="space-y-3">
                {reviewers.map((reviewer, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">Reviewer {index + 1}</h4>
                      <button
                        onClick={() => removeReviewer(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Name"
                        value={reviewer.name}
                        onChange={(e) => updateReviewer(index, 'name', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={reviewer.email}
                        onChange={(e) => updateReviewer(index, 'email', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="mt-3">
                      <select
                        value={reviewer.relationship}
                        onChange={(e) => updateReviewer(index, 'relationship', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="manager">Manager</option>
                        <option value="peer">Peer</option>
                        <option value="direct_report">Direct Report</option>
                        <option value="cross_functional">Cross-Functional</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {reviewers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No reviewers added yet</p>
                  <p className="text-sm mt-1">Click "Add Reviewer" to get started</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Send */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-bold text-green-900 text-lg mb-2">✅ Ready to Send!</h3>
                <p className="text-green-700">
                  Review your survey details below and click "Send Survey" to notify all reviewers.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Survey Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex">
                      <span className="text-gray-600 w-32">Employee:</span>
                      <span className="font-medium text-gray-900">{selectedEmployee?.name}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-600 w-32">Survey Name:</span>
                      <span className="font-medium text-gray-900">{surveyName}</span>
                    </div>
                    {dueDate && (
                      <div className="flex">
                        <span className="text-gray-600 w-32">Due Date:</span>
                        <span className="font-medium text-gray-900">{new Date(dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex">
                      <span className="text-gray-600 w-32">Questions:</span>
                      <span className="font-medium text-gray-900">{selectedQuestions.length} questions</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-600 w-32">Reviewers:</span>
                      <span className="font-medium text-gray-900">{reviewers.length} reviewers</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Questions by Category</h4>
                  {categories.map(category => {
                    const categoryQuestions = selectedQuestions.filter(q => q.category === category);
                    if (categoryQuestions.length === 0) return null;
                    return (
                      <div key={category} className="mb-3">
                        <div className="font-medium text-gray-700 text-sm mb-1">{category} ({categoryQuestions.length})</div>
                        <ul className="text-sm text-gray-600 space-y-1 pl-4">
                          {categoryQuestions.map((q, i) => (
                            <li key={q.template_id}>• {q.question_text}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Reviewers</h4>
                  <div className="space-y-2">
                    {reviewers.map((reviewer, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <Mail className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">{reviewer.name}</span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-gray-600">{reviewer.email}</span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-gray-500 capitalize">{reviewer.relationship.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            {step === 4 && (
              <button
                onClick={() => handleCreateSurvey(true)}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save as Draft
              </button>
            )}
            <button
              onClick={() => {
                if (step < 4) {
                  if (step === 1 && (!selectedEmployeeId || !surveyName)) {
                    alert('Please select an employee and enter a survey name');
                    return;
                  }
                  if (step === 2 && selectedQuestions.length === 0) {
                    alert('Please select at least one question');
                    return;
                  }
                  setStep(step + 1);
                } else {
                  handleCreateSurvey(false);
                }
              }}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : step === 4 ? (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Survey
                </>
              ) : (
                'Next'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
