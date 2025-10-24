import { useState, useEffect } from 'react';
import { X, Send, Plus, Trash2, Edit2, Check, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Employee } from '../types';
import { useToast, EmployeeNameLink } from './unified';
import {
  QUESTION_LIBRARY,
  DEFAULT_QUESTION_IDS,
  getQuestionById,
} from '../lib/feedback360QuestionBank';

interface Quick360ModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  organizationId: string;
  onSurveyCreated: () => void;
}

interface Question {
  id: string;
  text: string;
  isEditing: boolean;
  isCustom: boolean;
}

interface Reviewer {
  name: string;
  email: string;
  relationship: 'manager' | 'peer' | 'direct_report' | 'cross_functional';
}

export default function Quick360Modal({
  isOpen,
  onClose,
  employee,
  organizationId,
  onSurveyCreated
}: Quick360ModalProps) {
  const { notify } = useToast();
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const defaults = DEFAULT_QUESTION_IDS.map((id) => {
        const question = getQuestionById(id);
        if (!question) return null;
        return {
          id: question.id,
          text: question.text,
          isEditing: false,
          isCustom: false,
        } satisfies Question;
      }).filter((q): q is Question => Boolean(q));

      setSelectedQuestions((current) => (current.length > 0 ? current : defaults));
      setShowSuggestions(true);
    }
  }, [isOpen]);

  const addLibraryQuestion = (questionId: string) => {
    const question = getQuestionById(questionId);
    if (!question) return;

    setSelectedQuestions((prev) => (
      prev.some((item) => item.id === question.id)
        ? prev
        : [...prev, {
            id: question.id,
            text: question.text,
            isEditing: false,
            isCustom: false,
          }]
    ));
  };

  const addCustomQuestion = () => {
    setSelectedQuestions((prev) => ([
      ...prev,
      {
        id: `custom-${Date.now()}`,
        text: '',
        isEditing: true,
        isCustom: true,
      },
    ]));
  };

  const toggleEdit = (id: string) => {
    setSelectedQuestions((prev) => prev.map((q) =>
      q.id === id ? { ...q, isEditing: !q.isEditing } : q
    ));
  };

  const updateQuestion = (id: string, newText: string) => {
    setSelectedQuestions((prev) => prev.map((q) =>
      q.id === id ? { ...q, text: newText } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setSelectedQuestions((prev) => prev.filter(q => q.id !== id));
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

  const handleSendSurvey = async () => {
    if (selectedQuestions.length === 0) {
      notify({
        title: 'Add questions before sending',
        description: 'Include at least one question in the 360° survey.',
        variant: 'warning',
      });
      return;
    }
    if (selectedQuestions.some((q) => !q.text.trim())) {
      notify({
        title: 'Complete question required',
        description: 'Finish or remove blank questions before sending the survey.',
        variant: 'warning',
      });
      return;
    }
    if (reviewers.length === 0) {
      notify({
        title: 'Add recipients',
        description: 'Invite at least one reviewer to send the survey.',
        variant: 'warning',
      });
      return;
    }
    if (reviewers.some(r => !r.name || !r.email)) {
      notify({
        title: 'Reviewer details needed',
        description: 'Every reviewer must have a name and email address.',
        variant: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      // Create survey
      const { data: survey, error: surveyError } = await supabase
        .from('feedback_360_surveys')
        .insert({
          employee_id: employee.id,
          survey_name: `360° Feedback - ${employee.name}`,
          status: 'active',
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

      notify({
        title: '360° survey sent',
        description: `${reviewers.length} reviewer${reviewers.length === 1 ? '' : 's'} invited for ${employee.name}.`,
        variant: 'success',
      });
      onSurveyCreated();
      handleClose();
    } catch (error) {
      console.error('Error creating survey:', error);
      notify({
        title: 'Failed to create survey',
        description: 'Please try again or reach out if the problem continues.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedQuestions([]);
    setReviewers([]);
    setDueDate('');
    setShowSuggestions(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">360° Feedback for 
                <EmployeeNameLink
                  employee={employee}
                  className="font-semibold text-white hover:text-blue-100 focus-visible:ring-white"
                  onClick={(event) => event.stopPropagation()}
                />
              </h2>
              <p className="text-blue-100 text-sm mt-0.5">{employee.title}</p>
            </div>
            <button onClick={handleClose} className="text-white hover:text-gray-200 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📝 Select & Customize Questions</h3>
            <p className="text-sm text-blue-700 mb-2">
              Choose from our library of hard-hitting questions below, or edit them to match your needs.
            </p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>✓ 3 powerful questions already selected for you</li>
              <li>✓ Click any suggested question to add it</li>
              <li>✓ Click the pencil icon to customize any question</li>
              <li>✓ Add your own custom questions</li>
            </ul>
          </div>

          {/* Questions Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Selected Questions ({selectedQuestions.length})</h3>
              <button
                onClick={addCustomQuestion}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Custom
              </button>
            </div>

            {/* Selected Questions */}
            <div className="space-y-3 mb-6">
              {selectedQuestions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-semibold text-blue-600 mt-1">{index + 1}.</span>
                    <div className="flex-1">
                      {question.isEditing ? (
                        <textarea
                          value={question.text}
                          onChange={(e) => updateQuestion(question.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                          placeholder="Enter your question..."
                          autoFocus
                        />
                      ) : (
                        <p className="text-gray-900">{question.text}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleEdit(question.id)}
                        className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                        title={question.isEditing ? "Save" : "Edit"}
                      >
                        {question.isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => removeQuestion(question.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Suggested Questions */}
            {showSuggestions && (
              <div className="border-2 border-purple-300 rounded-lg p-5 bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-purple-900 flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5" />
                      Question Library
                    </h4>
                    <p className="text-sm text-purple-700 mt-1">Click any question below to add it to your survey</p>
                  </div>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                  >
                    Hide Library
                  </button>
                </div>
            {QUESTION_LIBRARY.map((group) => (
              <div key={group.id} className="mb-5 last:mb-0">
                <div className="bg-purple-100 px-3 py-2 rounded-t-lg border-b-2 border-purple-300">
                  <p className="text-sm font-bold text-purple-900">{group.title}</p>
                </div>
                <div className="space-y-2 mt-2">
                  {group.questions.map((q) => {
                    const isAdded = selectedQuestions.some((sq) => sq.id === q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => addLibraryQuestion(q.id)}
                        disabled={isAdded}
                        className={`w-full text-left p-3 rounded-lg text-sm transition-all border-2 ${
                          isAdded
                                ? 'bg-green-100 text-green-900 border-green-400 cursor-default font-medium'
                                : 'bg-white hover:bg-blue-100 hover:border-blue-400 text-gray-800 border-gray-200 hover:shadow-md'
                            }`}
                          >
                        {isAdded ? '✓ Added: ' : '+ '}{q.text}
                      </button>
                    );
                  })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!showSuggestions && (
              <button
                onClick={() => setShowSuggestions(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Show suggested questions
              </button>
            )}
          </div>

          {/* Reviewers Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reviewers</h3>
              <button
                onClick={addReviewer}
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Reviewer
              </button>
            </div>

            <div className="space-y-3">
              {reviewers.map((reviewer, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="grid grid-cols-2 gap-3 mb-3">
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
                  <div className="flex gap-3">
                    <select
                      value={reviewer.relationship}
                      onChange={(e) => updateReviewer(index, 'relationship', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="manager">Manager</option>
                      <option value="peer">Peer</option>
                      <option value="direct_report">Direct Report</option>
                      <option value="cross_functional">Cross-Functional</option>
                    </select>
                    <button
                      onClick={() => removeReviewer(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {reviewers.length === 0 && (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                <Mail className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No reviewers added yet</p>
                <p className="text-sm mt-1">Add people who will provide feedback</p>
              </div>
            )}
          </div>

          {/* Due Date */}
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

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedQuestions.length} questions • {reviewers.length} reviewers
          </div>
          <button
            onClick={handleSendSurvey}
            disabled={loading || selectedQuestions.length === 0 || reviewers.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Survey
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
