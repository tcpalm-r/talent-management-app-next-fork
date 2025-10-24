import { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  User,
  CheckSquare,
  Users,
  Calendar,
  Shield,
  Eye,
  Send,
  Sparkles,
} from 'lucide-react';
import type { Employee, Survey360, ParticipantRelationship } from '../types';
import { useToast } from './unified';
import { supabase } from '../lib/supabase';
import {
  QUESTION_LIBRARY,
  DEFAULT_QUESTION_IDS,
  getQuestionById,
  getQuestionsByCategory,
} from '../lib/feedback360QuestionBank';

interface Survey360WizardProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  preselectedEmployee?: Employee;
  preselectedEmployees?: Employee[]; // Batch mode
  onSurveyCreated: () => void;
  employees: Employee[];
}

type WizardStep = 'who' | 'competencies' | 'raters' | 'timeline' | 'privacy' | 'preview';

interface Rater {
  name: string;
  email: string;
  relationship: ParticipantRelationship;
}

const SURVEY_TEMPLATES = [
  {
    id: 'new-hire-60',
    name: 'New Hire 60-Day Check-in',
    description: '6 questions focused on onboarding experience and early integration',
    questionIds: DEFAULT_QUESTION_IDS.slice(0, 6),
    suggestedRaters: { manager: 1, peer: 2, cross_functional: 1 },
  },
  {
    id: 'role-change',
    name: 'Role Change Assessment',
    description: '8 questions covering transition effectiveness and skill fit',
    questionIds: DEFAULT_QUESTION_IDS.slice(0, 8),
    suggestedRaters: { manager: 1, peer: 3, direct_report: 1 },
  },
  {
    id: 'performance-support',
    name: 'Performance Review Support',
    description: '10 comprehensive questions for annual review insights',
    questionIds: DEFAULT_QUESTION_IDS,
    suggestedRaters: { manager: 1, peer: 3, direct_report: 2, cross_functional: 1 },
  },
];

export default function Survey360Wizard({
  isOpen,
  onClose,
  organizationId,
  preselectedEmployee,
  preselectedEmployees,
  onSurveyCreated,
  employees,
}: Survey360WizardProps) {
  const { notify } = useToast();
  const isBatchMode = !!preselectedEmployees && preselectedEmployees.length > 0;
  const [currentStep, setCurrentStep] = useState<WizardStep>(isBatchMode ? 'competencies' : 'who');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(preselectedEmployee);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(DEFAULT_QUESTION_IDS);
  const [raters, setRaters] = useState<Rater[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const steps: WizardStep[] = ['who', 'competencies', 'raters', 'timeline', 'privacy', 'preview'];
  const currentStepIndex = steps.indexOf(currentStep);

  const canProceed = () => {
    switch (currentStep) {
      case 'who':
        return isBatchMode || !!selectedEmployee;
      case 'competencies':
        return selectedQuestionIds.length > 0;
      case 'raters':
        return raters.length >= 1;
      case 'timeline':
        return !!dueDate;
      case 'privacy':
        return true;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = SURVEY_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    setSelectedQuestionIds(template.questionIds);
    
    // Auto-add suggested raters
    const newRaters: Rater[] = [];
    Object.entries(template.suggestedRaters).forEach(([relationship, count]) => {
      for (let i = 0; i < count; i++) {
        newRaters.push({
          name: '',
          email: '',
          relationship: relationship as ParticipantRelationship,
        });
      }
    });
    setRaters(newRaters);

    // Set default title
    setSurveyTitle(`${template.name} - ${selectedEmployee?.name}`);
  };

  const handleCreate = async () => {
    const employeesToProcess = isBatchMode ? preselectedEmployees : (selectedEmployee ? [selectedEmployee] : []);
    if (employeesToProcess.length === 0) return;

    setIsCreating(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const employee of employeesToProcess) {
        try {
          // Create survey
          const { data: survey, error: surveyError } = await supabase
            .from('feedback_360_surveys')
            .insert({
              employee_id: employee.id,
              survey_name: surveyTitle || `360° Feedback - ${employee.name}`,
              status: 'draft',
              due_date: dueDate,
              created_by: 'current-user',
            })
            .select()
            .single();

          if (surveyError) throw surveyError;

          // Ensure questions exist in database and get their UUIDs
          const questionUUIDs: string[] = [];
          for (const questionId of selectedQuestionIds) {
            const questionData = getQuestionById(questionId);
            if (!questionData) continue;

            // Check if question exists, if not create it
            let { data: existingQuestion, error: checkError } = await supabase
              .from('feedback_360_questions')
              .select('id')
              .eq('question_text', questionData.text)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              // PGRST116 = no rows returned, which is fine
              throw checkError;
            }

            if (!existingQuestion) {
              // Create the question
              const { data: newQuestion, error: createError } = await supabase
                .from('feedback_360_questions')
                .insert({
                  question_text: questionData.text,
                  category: 'general',
                  is_default: true,
                  is_active: true,
                })
                .select('id')
                .single();

              if (createError) throw createError;
              questionUUIDs.push(newQuestion.id);
            } else {
              questionUUIDs.push(existingQuestion.id);
            }
          }

          // Create survey questions with UUIDs
          const questionsToInsert = questionUUIDs.map((questionUUID, index) => ({
            survey_id: survey.id,
            question_id: questionUUID,
            question_order: index,
          }));

          if (questionsToInsert.length > 0) {
            const { error: questionsError } = await supabase
              .from('feedback_360_survey_questions')
              .insert(questionsToInsert);

            if (questionsError) throw questionsError;
          }

          // Create reviewers
          const reviewersToInsert = raters
            .filter(r => r.name && r.email)
            .map(r => ({
              survey_id: survey.id,
              reviewer_name: r.name,
              reviewer_email: r.email,
              relationship: r.relationship,
              status: 'pending',
              access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            }));

          if (reviewersToInsert.length > 0) {
            const { data: insertedReviewers, error: reviewersError } = await supabase
              .from('feedback_360_survey_reviewers')
              .insert(reviewersToInsert)
              .select();

            if (reviewersError) throw reviewersError;

            // Send invitation emails to each reviewer
            if (insertedReviewers && insertedReviewers.length > 0) {
              const emailPromises = insertedReviewers.map(async (reviewer) => {
                try {
                  const response = await fetch('/api/send-survey-invitation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      surveyId: survey.id,
                      reviewerId: reviewer.id,
                    }),
                  });

                  if (!response.ok) {
                    const error = await response.json();
                    console.error(`Failed to send email to ${reviewer.reviewer_email}:`, error);
                  }
                } catch (error) {
                  console.error(`Error sending email to ${reviewer.reviewer_email}:`, error);
                }
              });

              // Wait for all emails to be sent (don't block on failures)
              await Promise.allSettled(emailPromises);
            }
          }

          successCount++;
        } catch (error) {
          console.error(`Error creating survey for ${employee.name}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        notify({
          title: '360 Reviews Launched',
          description: isBatchMode 
            ? `Successfully created ${successCount} 360° survey${successCount > 1 ? 's' : ''}. Add context while you wait for feedback!`
            : `360° survey for ${employeesToProcess[0].name} created with ${raters.length} raters.`,
          variant: 'success',
          durationMs: 8000,
        });
      }

      if (failCount > 0) {
        notify({
          title: 'Some Surveys Failed',
          description: `${failCount} survey${failCount > 1 ? 's' : ''} could not be created. Please try again.`,
          variant: 'warning',
        });
      }

      onSurveyCreated();
      onClose();
    } catch (error) {
      console.error('Error creating surveys:', error);
      notify({
        title: 'Creation Failed',
        description: 'Failed to create 360° surveys. Please try again.',
        variant: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isBatchMode ? `Create 360° Surveys for ${preselectedEmployees.length} Team Members` : 'Create 360° Survey'}
              </h2>
              <p className="text-sm text-gray-600">
                Step {currentStepIndex + 1} of {steps.length}: {currentStep.replace('-', ' ')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded ${
                      index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Who */}
          {currentStep === 'who' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Who is this survey for?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select the employee who will receive 360° feedback
                </p>
              </div>

              {/* Templates */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Start with a Template
                </h4>
                <div className="space-y-2">
                  {SURVEY_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedTemplate === template.id
                          ? 'border-purple-500 bg-white shadow-md'
                          : 'border-purple-200 bg-white/50 hover:border-purple-300 hover:bg-white'
                      }`}
                    >
                      <div className="font-semibold text-gray-900 text-sm">{template.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {employees.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      selectedEmployee?.id === emp.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{emp.name}</div>
                    {emp.title && <div className="text-sm text-gray-600">{emp.title}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Competencies */}
          {currentStep === 'competencies' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Competencies to Assess</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose {selectedQuestionIds.length} questions from our library or add custom ones
                </p>
              </div>

              <div className="space-y-3">
                {Object.entries(getQuestionsByCategory()).map(([category, questions]) => (
                  <div key={category} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{category}</h4>
                    <div className="space-y-2">
                      {questions.map(q => (
                        <label key={q.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedQuestionIds.includes(q.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                              } else {
                                setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== q.id));
                              }
                            }}
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-700">{q.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Raters */}
          {currentStep === 'raters' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Raters</h3>
                <p className="text-sm text-gray-600 mb-4">
                  At least 1 rater required. Diverse perspectives provide better insights.
                </p>
              </div>

              <div className="space-y-3">
                {raters.map((rater, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <select
                      value={rater.relationship}
                      onChange={(e) => {
                        const updated = [...raters];
                        updated[index].relationship = e.target.value as ParticipantRelationship;
                        setRaters(updated);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="manager">Manager</option>
                      <option value="peer">Peer</option>
                      <option value="direct_report">Direct Report</option>
                      <option value="cross_functional">Cross-Functional</option>
                    </select>
                    <input
                      type="text"
                      value={rater.name}
                      onChange={(e) => {
                        const updated = [...raters];
                        updated[index].name = e.target.value;
                        setRaters(updated);
                      }}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="email"
                      value={rater.email}
                      onChange={(e) => {
                        const updated = [...raters];
                        updated[index].email = e.target.value;
                        setRaters(updated);
                      }}
                      placeholder="Email"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setRaters(raters.filter((_, i) => i !== index))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  setRaters([...raters, { name: '', email: '', relationship: 'peer' }])
                }
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Add Rater
              </button>
            </div>
          )}

          {/* Step 4: Timeline */}
          {currentStep === 'timeline' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Set Timeline</h3>
                <p className="text-sm text-gray-600 mb-4">When should raters complete their feedback?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Recommended:</strong> Allow 7-14 days for raters to complete thoughtful feedback.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Privacy */}
          {currentStep === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Privacy Settings</h3>
                <p className="text-sm text-gray-600 mb-4">Control how feedback is shared</p>
              </div>

              <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-gray-900">Anonymous Feedback</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Rater identities are hidden to encourage honest feedback. Manager feedback is always attributed.
                  </div>
                </div>
              </label>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <strong>Privacy Note:</strong> Individual responses are aggregated. Only themes and patterns are shared, never individual comments unless from manager.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Review & Launch</h3>
                <p className="text-sm text-gray-600 mb-4">Confirm details before sending</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Employee</div>
                  <div className="font-semibold text-gray-900">{selectedEmployee?.name}</div>
                  <div className="text-sm text-gray-600">{selectedEmployee?.title}</div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">Questions ({selectedQuestionIds.length})</div>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {selectedQuestionIds.slice(0, 3).map(id => {
                      const q = getQuestionById(id);
                      return q ? <li key={id}>• {q.text}</li> : null;
                    })}
                    {selectedQuestionIds.length > 3 && (
                      <li className="text-gray-500">... and {selectedQuestionIds.length - 3} more</li>
                    )}
                  </ul>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">Raters ({raters.length})</div>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {raters.map((r, i) => (
                      <li key={i}>
                        • {r.name || 'Pending'} ({r.relationship})
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Due Date</div>
                  <div className="font-semibold text-gray-900">
                    {new Date(dueDate).toLocaleDateString()}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Privacy</div>
                  <div className="font-semibold text-gray-900">
                    {isAnonymous ? 'Anonymous (recommended)' : 'Non-anonymous'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={currentStepIndex === 0 ? onClose : handleBack}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating || !canProceed()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isCreating ? (
                <>Creating...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Launch Survey
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

